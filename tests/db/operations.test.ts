import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";

import { asAuthenticated, requireLocalPostgres } from "./postgres";
import { insertAuthUser, seedRlsFixture, type RlsFixture } from "./seed";

let client: Client;
let fixture: RlsFixture;
let managerA: string;

beforeAll(async () => {
  client = await requireLocalPostgres();
  fixture = await seedRlsFixture(client);
  managerA = await insertAuthUser(client, "manager-a@onwarda-rls.test");
  await client.query(
    `
      insert into public.organization_users (organization_id, user_id, role, status)
      values ($1, $2, 'manager', 'active')
    `,
    [fixture.orgA, managerA],
  );
}, 30_000);

afterAll(async () => {
  await client?.end();
});

describe("operational role enforcement", () => {
  it("lets a manager create a reservation in their organization", async () => {
    await asAuthenticated(client, managerA, async () => {
      const result = await client.query(
        `
          insert into public.reservations (
            organization_id, property_id, guest_id, reservation_reference,
            booking_source, check_in, check_out, status
          ) values (
            $1, $2, $3, 'MGR-100', 'direct', current_date + 11, current_date + 14, 'upcoming'
          )
          returning id
        `,
        [fixture.orgA, fixture.propertyA, fixture.guestA],
      );

      expect(result.rowCount).toBe(1);
    });
  });

  it("prevents staff from creating reservations or guests", async () => {
    await asAuthenticated(client, fixture.staffA, async () => {
      await expect(
        client.query(
          `
            insert into public.reservations (
              organization_id, property_id, guest_id, reservation_reference,
              booking_source, check_in, check_out
            ) values (
              $1, $2, $3, 'STAFF-100', 'direct', current_date + 21, current_date + 24
            )
          `,
          [fixture.orgA, fixture.propertyA, fixture.guestA],
        ),
      ).rejects.toThrow(/row-level security/i);
    });

    await asAuthenticated(client, fixture.staffA, async () => {
      await expect(
        client.query(
          `
            insert into public.guests (organization_id, first_name, last_name, email)
            values ($1, 'Staff', 'Created', 'staff-created@onwarda-rls.test')
          `,
          [fixture.orgA],
        ),
      ).rejects.toThrow(/row-level security/i);
    });
  });

  it("prevents staff from updating properties", async () => {
    await asAuthenticated(client, fixture.staffA, async () => {
      const result = await client.query(
        "update public.properties set name = 'Staff Edit' where id = $1",
        [fixture.propertyA],
      );

      expect(result.rowCount).toBe(0);
    });
  });
});

describe("reservation relationship consistency", () => {
  it("rejects attaching an Organization B property to an Organization A reservation", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      await expect(
        client.query(
          `
            insert into public.reservations (
              organization_id, property_id, guest_id, reservation_reference,
              booking_source, check_in, check_out
            ) values (
              $1, $2, $3, 'PROP-MISMATCH', 'direct', current_date + 31, current_date + 34
            )
          `,
          [fixture.orgA, fixture.propertyB, fixture.guestA],
        ),
      ).rejects.toThrow(/does not belong|row-level security/i);
    });
  });

  it("rejects attaching an Organization B guest to an Organization A reservation", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      await expect(
        client.query(
          `
            insert into public.reservations (
              organization_id, property_id, guest_id, reservation_reference,
              booking_source, check_in, check_out
            ) values (
              $1, $2, $3, 'GUEST-MISMATCH', 'direct', current_date + 41, current_date + 44
            )
          `,
          [fixture.orgA, fixture.propertyA, fixture.guestB],
        ),
      ).rejects.toThrow(/does not belong|row-level security/i);
    });
  });
});

describe("tenant-scoped guest matching", () => {
  it("allows the same guest email in two organizations", async () => {
    await client.query(
      `
        insert into public.guests (organization_id, first_name, last_name, email)
        values
          ($1, 'Shared', 'Inbox', 'shared@onwarda-rls.test'),
          ($2, 'Shared', 'Inbox', 'shared@onwarda-rls.test')
      `,
      [fixture.orgA, fixture.orgB],
    );

    const visibleToA = await asAuthenticated(client, fixture.userA, async () => {
      return client.query(
        "select id from public.guests where email = 'shared@onwarda-rls.test'",
      );
    });
    const visibleToB = await asAuthenticated(client, fixture.userB, async () => {
      return client.query(
        "select id from public.guests where email = 'shared@onwarda-rls.test'",
      );
    });

    expect(visibleToA.rowCount).toBe(1);
    expect(visibleToB.rowCount).toBe(1);
    expect(visibleToA.rows[0]?.id).not.toBe(visibleToB.rows[0]?.id);
  });
});
