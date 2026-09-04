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

describe("IDOR against tenant-owned UUIDs", () => {
  it("rejects a property UUID belonging to another organization", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      const result = await client.query(
        "select * from public.properties where id = $1",
        [fixture.propertyB],
      );
      expect(result.rowCount).toBe(0);
    });
  });

  it("rejects a guest UUID belonging to another organization", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      const result = await client.query(
        "select * from public.guests where id = $1",
        [fixture.guestB],
      );
      expect(result.rowCount).toBe(0);
    });
  });

  it("rejects a reservation UUID belonging to another organization", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      const result = await client.query(
        "select * from public.reservations where id = $1",
        [fixture.reservationB],
      );
      expect(result.rowCount).toBe(0);
    });
  });

  it("rejects updating another organization's reservation by UUID", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      const result = await client.query(
        "update public.reservations set notes = 'cross-tenant' where id = $1",
        [fixture.reservationB],
      );
      expect(result.rowCount).toBe(0);
    });
  });

  it("rejects deleting another organization's property by UUID", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      const result = await client.query(
        "delete from public.properties where id = $1",
        [fixture.propertyB],
      );
      expect(result.rowCount).toBe(0);
    });
  });

  it("rejects creating a record under another organization_id", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      await expect(
        client.query(
          `
            insert into public.issues (
              organization_id, property_id, category, description
            ) values ($1, $2, 'other', 'Should fail')
          `,
          [fixture.orgB, fixture.propertyB],
        ),
      ).rejects.toThrow(/row-level security|does not belong|not scoped/i);
    });
  });

  it("rejects reading another organization's branding by organization UUID", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      const result = await client.query(
        "select * from public.organization_branding where organization_id = $1",
        [fixture.orgB],
      );
      expect(result.rowCount).toBe(0);
    });
  });

  it("rejects pairing organization A with a property from organization B", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      await expect(
        client.query(
          `
            insert into public.reservations (
              organization_id, property_id, guest_id, reservation_reference,
              booking_source, check_in, check_out
            ) values (
              $1, $2, $3, 'MIXED', 'direct', current_date + 1, current_date + 2
            )
          `,
          [fixture.orgA, fixture.propertyB, fixture.guestA],
        ),
      ).rejects.toThrow();
    });
  });
});
