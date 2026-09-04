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
      where bucket_id = 'organization-branding'
        and name like 'organizations/%'
    `,
  );
  await client.query(
    `
      insert into storage.objects (bucket_id, name, owner)
      values
        (
          'organization-branding',
          'organizations/' || $1 || '/branding/logo.png',
          $3
        ),
        (
          'organization-branding',
          'organizations/' || $2 || '/branding/logo.png',
          $4
        )
    `,
    [fixture.orgA, fixture.orgB, fixture.userA, fixture.userB],
  );
  await client.query("set session_replication_role = origin");
}, 30_000);

afterAll(async () => {
  await client.query("set session_replication_role = replica");
  await client.query(
    `
      delete from storage.objects
      where bucket_id = 'organization-branding'
        and name like 'organizations/%'
    `,
  );
  await client.query("set session_replication_role = origin");
  await client?.end();
});

describe("organization branding model", () => {
  it("creates one default branding row per organization", async () => {
    const rows = await client.query<{
      organization_id: string;
      display_name: string | null;
      logo_path: string | null;
    }>(
      `
        select organization_id, display_name, logo_path
        from public.organization_branding
        where organization_id in ($1, $2)
        order by display_name
      `,
      [fixture.orgA, fixture.orgB],
    );

    expect(rows.rowCount).toBe(2);
    expect(rows.rows.map((row) => row.display_name)).toEqual([
      "Luxury Villas",
      "Riad Atlas",
    ]);
    expect(rows.rows.every((row) => row.logo_path === null)).toBe(true);
  });

  it("rejects a second branding row for the same organization", async () => {
    await expect(
      client.query(
        "insert into public.organization_branding (organization_id) values ($1)",
        [fixture.orgA],
      ),
    ).rejects.toThrow(/duplicate key|unique/i);
  });

  it("rejects unsafe brand colors", async () => {
    await expect(
      client.query(
        `
          update public.organization_branding
          set primary_color = 'url(https://evil.example)'
          where organization_id = $1
        `,
        [fixture.orgA],
      ),
    ).rejects.toThrow(/branding_primary_color|check/i);
  });
});

describe("organization branding RLS", () => {
  it("lets an owner read their branding and not another organization's", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      const own = await client.query(
        "select organization_id from public.organization_branding where organization_id = $1",
        [fixture.orgA],
      );
      const foreign = await client.query(
        "select organization_id from public.organization_branding where organization_id = $1",
        [fixture.orgB],
      );

      expect(own.rowCount).toBe(1);
      expect(foreign.rowCount).toBe(0);
    });
  });

  it("lets an owner update their branding", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      const result = await client.query(
        `
          update public.organization_branding
          set display_name = 'Atlas House', primary_color = '#123456'
          where organization_id = $1
        `,
        [fixture.orgA],
      );

      expect(result.rowCount).toBe(1);
    });
  });

  it("prevents staff from updating branding", async () => {
    await asAuthenticated(client, fixture.staffA, async () => {
      const result = await client.query(
        `
          update public.organization_branding
          set display_name = 'Staff Brand'
          where organization_id = $1
        `,
        [fixture.orgA],
      );

      expect(result.rowCount).toBe(0);
    });
  });

  it("prevents an owner from updating another organization's branding", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      const result = await client.query(
        `
          update public.organization_branding
          set display_name = 'Stolen'
          where organization_id = $1
        `,
        [fixture.orgB],
      );

      expect(result.rowCount).toBe(0);
    });
  });

  it("rejects re-parenting branding onto another organization", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      await expect(
        client.query(
          `
            update public.organization_branding
            set organization_id = $1
            where organization_id = $2
          `,
          [fixture.orgB, fixture.orgA],
        ),
      ).rejects.toThrow(/cannot be changed|row-level security/i);
    });
  });

  it("rejects a logo path scoped to another organization", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      await expect(
        client.query(
          `
            update public.organization_branding
            set logo_path = $1
            where organization_id = $2
          `,
          [`organizations/${fixture.orgB}/branding/logo.png`, fixture.orgA],
        ),
      ).rejects.toThrow(/not scoped|row-level security/i);
    });
  });

  it("does not let a client user call the admin branding RPC", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      await expect(
        client.query(
          `
            select public.admin_set_organization_branding(
              $1, 'Hacked', '#123456', null, null
            )
          `,
          [fixture.orgB],
        ),
      ).rejects.toThrow(/not authorized/i);
    });
  });

  it("lets a platform admin update a selected organization's branding through the RPC", async () => {
    await asAuthenticated(client, fixture.platformAdmin, async () => {
      await client.query(
        `
          select public.admin_set_organization_branding(
            $1, 'Admin Set', '#654321', null, null
          )
        `,
        [fixture.orgA],
      );

      const row = await client.query<{ display_name: string | null }>(
        "select display_name from public.organization_branding where organization_id = $1",
        [fixture.orgA],
      );

      expect(row.rows[0]?.display_name).toBe("Admin Set");
    });
  });
});

describe("organization branding storage isolation", () => {
  it("lets an owner read only their branding object", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      const own = await client.query(
        `
          select name from storage.objects
          where bucket_id = 'organization-branding'
            and name like $1
        `,
        [`organizations/${fixture.orgA}/%`],
      );
      const foreign = await client.query(
        `
          select name from storage.objects
          where bucket_id = 'organization-branding'
            and name like $1
        `,
        [`organizations/${fixture.orgB}/%`],
      );

      expect(own.rowCount).toBe(1);
      expect(foreign.rowCount).toBe(0);
    });
  });

  it("rejects uploading a branding logo under another organization prefix", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      await expect(
        client.query(
          `
            insert into storage.objects (bucket_id, name, owner)
            values ('organization-branding', $1, $2)
          `,
          [`organizations/${fixture.orgB}/branding/logo.webp`, fixture.userA],
        ),
      ).rejects.toThrow(/row-level security|not allowed/i);
    });
  });

  it("prevents staff from writing branding storage objects", async () => {
    await asAuthenticated(client, fixture.staffA, async () => {
      await expect(
        client.query(
          `
            insert into storage.objects (bucket_id, name, owner)
            values ('organization-branding', $1, $2)
          `,
          [`organizations/${fixture.orgA}/branding/logo.webp`, fixture.staffA],
        ),
      ).rejects.toThrow(/row-level security|not allowed/i);
    });
  });

  it("prevents deleting another organization's branding logo", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      await expect(
        client.query(
          `
            delete from storage.objects
            where bucket_id = 'organization-branding'
              and name = $1
          `,
          [`organizations/${fixture.orgB}/branding/logo.png`],
        ),
      ).rejects.toThrow(/not allowed|row-level security/i);
    });

    const remaining = await client.query(
      `
        select name from storage.objects
        where bucket_id = 'organization-branding'
          and name = $1
      `,
      [`organizations/${fixture.orgB}/branding/logo.png`],
    );
    expect(remaining.rowCount).toBe(1);
  });
});
