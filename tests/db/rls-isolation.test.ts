import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";

import { asAnon, asAuthenticated, requireLocalPostgres } from "./postgres";
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

describe("RLS tenant isolation", () => {
  it("lets user A read organization A data", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      const properties = await client.query(
        "select id from public.properties where id = $1",
        [fixture.propertyA],
      );
      const reservations = await client.query(
        "select id from public.reservations where id = $1",
        [fixture.reservationA],
      );
      const guests = await client.query(
        "select id from public.guests where id = $1",
        [fixture.guestA],
      );

      expect(properties.rowCount).toBe(1);
      expect(reservations.rowCount).toBe(1);
      expect(guests.rowCount).toBe(1);
    });
  });

  it("prevents user A from selecting organization B rows", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      const organizations = await client.query(
        "select id from public.organizations where id = $1",
        [fixture.orgB],
      );
      const properties = await client.query("select id from public.properties");
      const reservations = await client.query(
        "select id from public.reservations",
      );
      const guests = await client.query("select id from public.guests");
      const issues = await client.query("select id from public.issues");
      const knowledge = await client.query(
        "select id from public.property_knowledge",
      );
      const events = await client.query("select id from public.events");

      expect(organizations.rowCount).toBe(0);
      expect(properties.rows.map((row) => row.id)).toEqual([fixture.propertyA]);
      expect(reservations.rows.map((row) => row.id)).toEqual([
        fixture.reservationA,
      ]);
      expect(guests.rows.map((row) => row.id)).toEqual([fixture.guestA]);
      expect(issues.rows.map((row) => row.id)).toEqual([fixture.issueA]);
      expect(knowledge.rows.map((row) => row.id)).toEqual([fixture.knowledgeA]);
      expect(events.rowCount).toBe(1);
    });
  });

  it("prevents user A from updating organization B data", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      const property = await client.query(
        "update public.properties set name = 'Hacked' where id = $1",
        [fixture.propertyB],
      );
      const reservation = await client.query(
        "update public.reservations set notes = 'Hacked' where id = $1",
        [fixture.reservationB],
      );
      const guest = await client.query(
        "update public.guests set first_name = 'Hacked' where id = $1",
        [fixture.guestB],
      );

      expect(property.rowCount).toBe(0);
      expect(reservation.rowCount).toBe(0);
      expect(guest.rowCount).toBe(0);
    });
  });

  it("prevents user A from deleting organization B data", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      const property = await client.query(
        "delete from public.properties where id = $1",
        [fixture.propertyB],
      );
      const reservation = await client.query(
        "delete from public.reservations where id = $1",
        [fixture.reservationB],
      );
      const guest = await client.query(
        "delete from public.guests where id = $1",
        [fixture.guestB],
      );

      expect(property.rowCount).toBe(0);
      expect(reservation.rowCount).toBe(0);
      expect(guest.rowCount).toBe(0);
    });
  });

  it("prevents user A from inserting a property for organization B", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      await expect(
        client.query(
          `
            insert into public.properties (organization_id, name, slug, status)
            values ($1, 'Stolen Villa', 'stolen-villa', 'draft')
          `,
          [fixture.orgB],
        ),
      ).rejects.toThrow(/row-level security|does not belong|not scoped/i);
    });
  });

  it("prevents user A from inserting a guest for organization B", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      await expect(
        client.query(
          `
            insert into public.guests (organization_id, first_name, last_name)
            values ($1, 'Stolen', 'Guest')
          `,
          [fixture.orgB],
        ),
      ).rejects.toThrow(/row-level security|does not belong|not scoped/i);
    });
  });

  it("does not trust a supplied organization B UUID from user A", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      await expect(
        client.query(
          `
            insert into public.reservations (
              organization_id, property_id, guest_id, reservation_reference,
              booking_source, check_in, check_out
            ) values (
              $1, $7, $5, 'FORGED', 'direct', current_date + 1, current_date + 2
            )
          `,
          [
            fixture.orgB,
            fixture.orgA,
            fixture.propertyB,
            fixture.propertyA,
            fixture.guestA,
            fixture.guestB,
            fixture.propertyB,
          ],
        ),
      ).rejects.toThrow();
    });
  });

  it("repeats isolation for user B", async () => {
    await asAuthenticated(client, fixture.userB, async () => {
      const own = await client.query(
        "select id from public.properties where organization_id = $1",
        [fixture.orgB],
      );
      const foreign = await client.query(
        "select id from public.properties where organization_id = $1",
        [fixture.orgA],
      );
      const updateForeign = await client.query(
        "update public.properties set name = 'Nope' where id = $1",
        [fixture.propertyA],
      );

      expect(own.rowCount).toBe(1);
      expect(foreign.rowCount).toBe(0);
      expect(updateForeign.rowCount).toBe(0);
    });
  });

  it("does not give platform admins implicit tenant access", async () => {
    await asAuthenticated(client, fixture.platformAdmin, async () => {
      const properties = await client.query("select id from public.properties");
      const organizations = await client.query(
        "select id from public.organizations",
      );

      expect(properties.rowCount).toBe(0);
      expect(organizations.rowCount).toBe(0);
    });
  });

  it("denies anonymous access to properties", async () => {
    await asAnon(client, async () => {
      await expect(
        client.query("select id from public.properties"),
      ).rejects.toThrow(/permission denied/i);
    });
  });

  it("denies anonymous access to guest portal tokens", async () => {
    await asAnon(client, async () => {
      await expect(
        client.query("select token_hash from public.guest_portal_tokens"),
      ).rejects.toThrow(/permission denied/i);
    });
  });
});
