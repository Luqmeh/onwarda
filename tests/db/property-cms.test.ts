import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";

import { asAuthenticated, requireLocalPostgres } from "./postgres";
import { insertAuthUser, seedRlsFixture, type RlsFixture } from "./seed";

let client: Client;
let fixture: RlsFixture;
let managerA: string;
let mediaA: string;
let mediaB: string;
let ruleA: string;
let contentA: string;
let storagePathA: string;
let storagePathB: string;

beforeAll(async () => {
  client = await requireLocalPostgres();
  fixture = await seedRlsFixture(client);
  managerA = await insertAuthUser(client, "cms-manager-a@onwarda-rls.test");
  await client.query(
    `
      insert into public.organization_users (organization_id, user_id, role, status)
      values ($1, $2, 'manager', 'active')
    `,
    [fixture.orgA, managerA],
  );

  mediaA = randomUUID();
  mediaB = randomUUID();
  ruleA = randomUUID();
  contentA = randomUUID();
  storagePathA = `organizations/${fixture.orgA}/properties/${fixture.propertyA}/media/${mediaA}.png`;
  storagePathB = `organizations/${fixture.orgB}/properties/${fixture.propertyB}/media/${mediaB}.png`;

  await client.query(
    `
      insert into public.property_amenities (organization_id, property_id, amenity_key)
      values ($1, $3, 'wifi'), ($2, $4, 'pool')
    `,
    [fixture.orgA, fixture.orgB, fixture.propertyA, fixture.propertyB],
  );

  await client.query(
    `
      insert into public.property_house_rules (
        id, organization_id, property_id, rule_key, state, details, visibility
      ) values
        ($1, $3, $5, 'smoking', 'not_allowed', 'No smoking', 'public'),
        ($2, $4, $6, 'pets', 'not_allowed', 'No pets', 'private')
    `,
    [ruleA, randomUUID(), fixture.orgA, fixture.orgB, fixture.propertyA, fixture.propertyB],
  );

  await client.query(
    `
      insert into public.property_content (
        id, organization_id, property_id, field_key, body, visibility
      ) values
        ($1, $3, $5, 'lockbox_instructions', 'Code 1111', 'guest'),
        ($2, $4, $6, 'private_notes', 'Owner note B', 'private')
    `,
    [contentA, randomUUID(), fixture.orgA, fixture.orgB, fixture.propertyA, fixture.propertyB],
  );

  await client.query(
    `
      insert into public.property_media (
        id, organization_id, property_id, media_type, role, storage_path, visibility
      ) values
        ($1, $3, $5, 'image', 'hero', $7, 'public'),
        ($2, $4, $6, 'image', 'hero', $8, 'public')
    `,
    [
      mediaA,
      mediaB,
      fixture.orgA,
      fixture.orgB,
      fixture.propertyA,
      fixture.propertyB,
      storagePathA,
      storagePathB,
    ],
  );

  await client.query("set session_replication_role = replica");
  await client.query(
    `
      delete from storage.objects
      where bucket_id = 'property-media' and name like 'organizations/%'
    `,
  );
  await client.query(
    `
      insert into storage.objects (bucket_id, name, owner)
      values
        ('property-media', $1, $3),
        ('property-media', $2, $4)
    `,
    [storagePathA, storagePathB, fixture.userA, fixture.userB],
  );
  await client.query("set session_replication_role = origin");
}, 30_000);

afterAll(async () => {
  await client.query("set session_replication_role = replica");
  await client.query(
    `
      delete from storage.objects
      where bucket_id = 'property-media' and name like 'organizations/%'
    `,
  );
  await client.query("set session_replication_role = origin");
  await client?.end();
});

describe("property CMS RLS", () => {
  it("keeps CMS tables RLS enabled and forced", async () => {
    const result = await client.query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      `
        select relname, relrowsecurity, relforcerowsecurity
        from pg_class
        where relname in (
          'property_amenities',
          'property_house_rules',
          'property_content',
          'property_media',
          'property_languages'
        )
      `,
    );

    expect(result.rowCount).toBe(5);
    expect(result.rows.every((row) => row.relrowsecurity && row.relforcerowsecurity)).toBe(true);
  });

  it("lets a manager update amenities in their organization", async () => {
    await asAuthenticated(client, managerA, async () => {
      const result = await client.query(
        `
          insert into public.property_amenities (organization_id, property_id, amenity_key)
          values ($1, $2, 'kitchen')
          returning id
        `,
        [fixture.orgA, fixture.propertyA],
      );
      expect(result.rowCount).toBe(1);
    });
  });

  it("prevents staff from mutating CMS rows or media", async () => {
    await asAuthenticated(client, fixture.staffA, async () => {
      await expect(
        client.query(
          `
            insert into public.property_amenities (organization_id, property_id, amenity_key)
            values ($1, $2, 'parking')
          `,
          [fixture.orgA, fixture.propertyA],
        ),
      ).rejects.toThrow(/row-level security/i);
    });

    await asAuthenticated(client, fixture.staffA, async () => {
      const updated = await client.query(
        "update public.property_house_rules set details = 'staff' where id = $1",
        [ruleA],
      );
      expect(updated.rowCount).toBe(0);
    });

    await asAuthenticated(client, fixture.staffA, async () => {
      await expect(
        client.query(
          `
            insert into storage.objects (bucket_id, name, owner)
            values ('property-media', $1, $2)
          `,
          [
            `organizations/${fixture.orgA}/properties/${fixture.propertyA}/media/${randomUUID()}.png`,
            fixture.staffA,
          ],
        ),
      ).rejects.toThrow(/row-level security|not allowed/i);
    });
  });

  it("rejects Client A reading Client B CMS rows", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      const amenities = await client.query(
        "select id from public.property_amenities where property_id = $1",
        [fixture.propertyB],
      );
      const rules = await client.query(
        "select id from public.property_house_rules where property_id = $1",
        [fixture.propertyB],
      );
      const content = await client.query(
        "select id from public.property_content where property_id = $1",
        [fixture.propertyB],
      );
      const media = await client.query(
        "select id from public.property_media where id = $1",
        [mediaB],
      );
      const knowledge = await client.query(
        "select id from public.property_knowledge where id = $1",
        [fixture.knowledgeB],
      );

      expect(amenities.rowCount).toBe(0);
      expect(rules.rowCount).toBe(0);
      expect(content.rowCount).toBe(0);
      expect(media.rowCount).toBe(0);
      expect(knowledge.rowCount).toBe(0);
    });
  });

  it("rejects attaching Organization B property children to Organization A", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      await expect(
        client.query(
          `
            insert into public.property_amenities (organization_id, property_id, amenity_key)
            values ($1, $2, 'tv')
          `,
          [fixture.orgA, fixture.propertyB],
        ),
      ).rejects.toThrow(/does not belong|row-level security/i);
    });
  });

  it("rejects reparenting CMS rows onto another organization", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      await expect(
        client.query(
          "update public.property_media set organization_id = $1 where id = $2",
          [fixture.orgB, mediaA],
        ),
      ).rejects.toThrow(/cannot be changed|row-level security/i);
    });
  });

  it("rejects making lockbox instructions public", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      await expect(
        client.query(
          "update public.property_content set visibility = 'public' where id = $1",
          [contentA],
        ),
      ).rejects.toThrow(/violates check constraint|sensitive/i);
    });
  });

  it("isolates property media storage paths", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      const own = await client.query(
        "select name from storage.objects where name = $1",
        [storagePathA],
      );
      const foreign = await client.query(
        "select name from storage.objects where name = $1",
        [storagePathB],
      );
      expect(own.rowCount).toBe(1);
      expect(foreign.rowCount).toBe(0);
    });
  });

  it("rejects writing property media under another organization or property", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      await expect(
        client.query(
          `
            insert into storage.objects (bucket_id, name, owner)
            values ('property-media', $1, $2)
          `,
          [storagePathB, fixture.userA],
        ),
      ).rejects.toThrow(/row-level security|not allowed/i);
    });

    await asAuthenticated(client, fixture.userA, async () => {
      await expect(
        client.query(
          `
            insert into storage.objects (bucket_id, name, owner)
            values ('property-media', $1, $2)
          `,
          [
            `organizations/${fixture.orgA}/properties/${fixture.propertyB}/media/${randomUUID()}.png`,
            fixture.userA,
          ],
        ),
      ).rejects.toThrow(/row-level security|not allowed/i);
    });
  });
});
