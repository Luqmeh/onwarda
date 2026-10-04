import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";

import { asAuthenticated, requireLocalPostgres } from "./postgres";
import { seedRlsFixture, type RlsFixture } from "./seed";

let client: Client;
let fixture: RlsFixture;

beforeAll(async () => {
  client = await requireLocalPostgres();
  fixture = await seedRlsFixture(client);
}, 30_000);

afterAll(async () => {
  await client?.end();
});

describe("support workspace RLS", () => {
  it("does not let a platform admin read tenant rows without a support session", async () => {
    await asAuthenticated(client, fixture.platformAdmin, async () => {
      const properties = await client.query(
        "select id from public.properties where organization_id = $1",
        [fixture.orgA],
      );
      expect(properties.rowCount).toBe(0);
    });
  });

  it("lets an active support session read only the selected organization", async () => {
    await asAuthenticated(client, fixture.platformAdmin, async () => {
      await client.query(
        "select public.start_support_session($1, 'Inspect reservations', 120)",
        [fixture.orgA],
      );

      const own = await client.query(
        "select id from public.properties where organization_id = $1",
        [fixture.orgA],
      );
      const other = await client.query(
        "select id from public.properties where organization_id = $1",
        [fixture.orgB],
      );
      const memberships = await client.query(
        "select id from public.organization_users where user_id = $1",
        [fixture.platformAdmin],
      );

      expect(own.rowCount).toBeGreaterThan(0);
      expect(other.rowCount).toBe(0);
      expect(memberships.rowCount).toBe(0);
    });
  });

  it("lets support read CMS rows but not mutate them", async () => {
    await asAuthenticated(client, fixture.platformAdmin, async () => {
      await client.query(
        "select public.start_support_session($1, 'Inspect property CMS', 120)",
        [fixture.orgA],
      );

      const knowledge = await client.query(
        "select id from public.property_knowledge where organization_id = $1",
        [fixture.orgA],
      );
      expect(knowledge.rowCount).toBeGreaterThan(0);

      await expect(
        client.query(
          `
            insert into public.property_amenities (organization_id, property_id, amenity_key)
            values ($1, $2, 'workspace')
          `,
          [fixture.orgA, fixture.propertyA],
        ),
      ).rejects.toThrow(/row-level security/i);
    });
  });

  it("rejects ended and expired support sessions", async () => {
    await asAuthenticated(client, fixture.platformAdmin, async () => {
      const started = await client.query<{ start_support_session: string }>(
        "select public.start_support_session($1, 'Close immediately', 120)",
        [fixture.orgA],
      );
      const sessionId = started.rows[0]?.start_support_session ?? "";
      await client.query("select public.end_support_session($1)", [sessionId]);

      const afterEnd = await client.query(
        "select id from public.properties where organization_id = $1",
        [fixture.orgA],
      );
      expect(afterEnd.rowCount).toBe(0);
    });

    const expired = await client.query<{ id: string }>(
      `
        insert into public.support_sessions (
          platform_admin_user_id, organization_id, reason, started_at, expires_at
        ) values ($1, $2, 'already expired', now() - interval '3 hours', now() - interval '1 hour')
        returning id
      `,
      [fixture.platformAdmin, fixture.orgA],
    );

    try {
      await asAuthenticated(client, fixture.platformAdmin, async () => {
        const rows = await client.query(
          "select id from public.properties where organization_id = $1",
          [fixture.orgA],
        );
        expect(rows.rowCount).toBe(0);
      });
    } finally {
      await client.query("delete from public.support_sessions where id = $1", [
        expired.rows[0]?.id,
      ]);
    }
  });
});
