import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";

import { asAuthenticated, requireLocalPostgres } from "./postgres";
import { seedRlsFixture, type RlsFixture } from "./seed";

let client: Client;
let fixture: RlsFixture;

beforeAll(async () => {
  client = await requireLocalPostgres();
  fixture = await seedRlsFixture(client);

  await client.query("set session_replication_role = replica");
  await client.query(
    `
      delete from storage.objects
      where bucket_id in (
        'organization-assets',
        'property-media',
        'guest-documents',
        'organization-branding'
      )
        and name like 'organizations/%'
    `,
  );

  await client.query(
    `
      insert into storage.objects (bucket_id, name, owner)
      values
        (
          'organization-assets',
          'organizations/' || $1 || '/logo.png',
          $3
        ),
        (
          'organization-assets',
          'organizations/' || $2 || '/logo.png',
          $4
        )
    `,
    [fixture.orgA, fixture.orgB, fixture.userA, fixture.userB],
  );
  await client.query("set session_replication_role = origin");
}, 30_000);

afterAll(async () => {
  await client?.end();
});

describe("red-team tenant and privilege attacks", () => {
  it("does not let invited members read tenant data", async () => {
    await asAuthenticated(client, fixture.invitedA, async () => {
      const properties = await client.query("select id from public.properties");
      expect(properties.rowCount).toBe(0);
    });
  });

  it("does not let suspended members read tenant data", async () => {
    await asAuthenticated(client, fixture.suspendedA, async () => {
      const properties = await client.query("select id from public.properties");
      expect(properties.rowCount).toBe(0);
    });
  });

  it("rejects re-parenting a property onto another organization", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      await expect(
        client.query(
          "update public.properties set organization_id = $1 where id = $2",
          [fixture.orgB, fixture.propertyA],
        ),
      ).rejects.toThrow(/cannot be changed|row-level security/i);
    });
  });

  it("rejects re-parenting a reservation onto another organization", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      await expect(
        client.query(
          "update public.reservations set organization_id = $1 where id = $2",
          [fixture.orgB, fixture.reservationA],
        ),
      ).rejects.toThrow(/cannot be changed|row-level security/i);
    });
  });

  it("rejects Org A + Property B event combinations", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      await expect(
        client.query(
          `
            insert into public.events (
              organization_id, property_id, event_type
            ) values ($1, $2, 'wifi_viewed')
          `,
          [fixture.orgA, fixture.propertyB],
        ),
      ).rejects.toThrow(/does not belong|row-level security/i);
    });
  });

  it("rejects authenticated events with a null organization_id", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      await expect(
        client.query(
          "insert into public.events (event_type) values ('wifi_viewed')",
        ),
      ).rejects.toThrow(/must include organization_id|row-level security/i);
    });
  });

  it("rejects mixing a reservation from Org A with a property from Org B", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      await expect(
        client.query(
          `
            update public.reservations
            set property_id = $1
            where id = $2
          `,
          [fixture.propertyB, fixture.reservationA],
        ),
      ).rejects.toThrow(/does not belong|row-level security/i);
    });
  });

  it("prevents platform admins from updating platform_admins rows", async () => {
    await asAuthenticated(client, fixture.platformAdmin, async () => {
      await expect(
        client.query(
          "update public.platform_admins set status = 'suspended' where user_id = $1",
          [fixture.platformAdmin],
        ),
      ).rejects.toThrow(/permission denied/i);
    });
  });

  it("prevents client users from inserting audit logs", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      await expect(
        client.query(
          `
            insert into public.audit_logs (
              actor_user_id, actor_type, action, target_type
            ) values ($1, 'organization_user', 'organization.updated', 'organization')
          `,
          [fixture.userA],
        ),
      ).rejects.toThrow(/permission denied/i);
    });
  });

  it("isolates private storage objects by organization path", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      const own = await client.query(
        "select name from storage.objects where name like $1",
        [`organizations/${fixture.orgA}/%`],
      );
      const foreign = await client.query(
        "select name from storage.objects where name like $1",
        [`organizations/${fixture.orgB}/%`],
      );

      expect(own.rowCount).toBe(1);
      expect(foreign.rowCount).toBe(0);
    });
  });

  it("rejects writing a storage object under another organization prefix", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      await expect(
        client.query(
          `
            insert into storage.objects (bucket_id, name, owner)
            values ('organization-assets', $1, $2)
          `,
          [`organizations/${fixture.orgB}/stolen.png`, fixture.userA],
        ),
      ).rejects.toThrow(/row-level security|not allowed/i);
    });
  });

  it("does not grant anon execute on handle_new_user", async () => {
    const result = await client.query<{ allowed: boolean }>(
      "select has_function_privilege('anon', 'public.handle_new_user()', 'execute') as allowed",
    );

    expect(result.rows[0]?.allowed).toBe(false);
  });

  it("does not grant authenticated execute on handle_new_user", async () => {
    const result = await client.query<{ allowed: boolean }>(
      "select has_function_privilege('authenticated', 'public.handle_new_user()', 'execute') as allowed",
    );

    expect(result.rows[0]?.allowed).toBe(false);
  });
});
