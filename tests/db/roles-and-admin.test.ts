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

describe("role restrictions and privilege escalation", () => {
  it("allows staff to write issues in their organization", async () => {
    await asAuthenticated(client, fixture.staffA, async () => {
      const result = await client.query(
        `
          insert into public.issues (
            organization_id, property_id, category, description
          ) values ($1, $2, 'other', 'Staff note')
          returning id
        `,
        [fixture.orgA, fixture.propertyA],
      );

      expect(result.rowCount).toBe(1);
    });
  });

  it("prevents staff from creating properties", async () => {
    await asAuthenticated(client, fixture.staffA, async () => {
      await expect(
        client.query(
          `
            insert into public.properties (organization_id, name, slug)
            values ($1, 'Staff Property', 'staff-property')
          `,
          [fixture.orgA],
        ),
      ).rejects.toThrow(/row-level security/i);
    });
  });

  it("prevents staff from updating organization settings", async () => {
    await asAuthenticated(client, fixture.staffA, async () => {
      const result = await client.query(
        "update public.organizations set name = 'Renamed by staff' where id = $1",
        [fixture.orgA],
      );

      expect(result.rowCount).toBe(0);
    });
  });

  it("prevents a client user from becoming a platform admin", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      await expect(
        client.query(
          `
            insert into public.platform_admins (user_id, role, status)
            values ($1, 'super_admin', 'active')
          `,
          [fixture.userA],
        ),
      ).rejects.toThrow(/permission denied|row-level security/i);
    });
  });

  it("prevents a client user from reading other platform admin rows", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      const result = await client.query("select * from public.platform_admins");
      expect(result.rowCount).toBe(0);
    });
  });

  it("lets a platform admin read only their own admin row", async () => {
    await asAuthenticated(client, fixture.platformAdmin, async () => {
      const result = await client.query("select user_id from public.platform_admins");
      expect(result.rows).toEqual([{ user_id: fixture.platformAdmin }]);
    });
  });

  it("prevents client users from reading audit logs", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      const result = await client.query("select id from public.audit_logs");
      expect(result.rowCount).toBe(0);
    });
  });

  it("lets a platform admin read audit logs", async () => {
    await asAuthenticated(client, fixture.platformAdmin, async () => {
      const result = await client.query("select action from public.audit_logs");
      expect(result.rowCount).toBe(1);
      expect(result.rows[0]?.action).toBe("organization.created");
    });
  });

  it("prevents authenticated users from updating events", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      try {
        const result = await client.query(
          "update public.events set event_type = 'tampered'",
        );
        expect(result.rowCount).toBe(0);
      } catch (error) {
        expect(String(error)).toMatch(/permission denied/i);
      }
    });
  });
});
