import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";

import { asAnon, asAuthenticated, requireLocalPostgres } from "./postgres";
import { seedRlsFixture, type RlsFixture } from "./seed";

let client: Client;
let fixture: RlsFixture;
let privatePropertyA: string;
let publicKnowledgeA: string;
let privateMediaA: string;

beforeAll(async () => {
  client = await requireLocalPostgres();
  fixture = await seedRlsFixture(client);
  privatePropertyA = randomUUID();
  publicKnowledgeA = randomUUID();
  privateMediaA = randomUUID();

  await client.query(
    `
      insert into public.properties (
        id, organization_id, name, slug, status, is_listed_publicly, internal_identifier
      ) values ($1, $2, 'Hidden Suite', 'hidden-suite', 'draft', true, 'HIDE-01')
    `,
    [privatePropertyA, fixture.orgA],
  );

  await client.query(
    `
      update public.properties
      set internal_identifier = 'ATLAS-PRIVATE'
      where id = $1
    `,
    [fixture.propertyA],
  );

  await client.query(
    `
      insert into public.property_content (
        organization_id, property_id, field_key, body, visibility
      ) values
        ($1, $3, 'neighborhood', 'Near the medina', 'public'),
        ($1, $3, 'lockbox_instructions', 'Code 1111', 'guest'),
        ($1, $3, 'private_notes', 'Owner only', 'private'),
        ($2, $4, 'neighborhood', 'Villa neighborhood', 'public')
      on conflict do nothing
    `,
    [fixture.orgA, fixture.orgB, fixture.propertyA, fixture.propertyB],
  );

  await client.query(
    `
      update public.property_knowledge
      set visibility = 'guest', body = 'atlas-secret-wifi'
      where id = $1
    `,
    [fixture.knowledgeA],
  );

  await client.query(
    `
      insert into public.property_knowledge (
        id, organization_id, property_id, category, title, body, locale, status, visibility
      ) values
        ($1, $2, $3, 'faq', 'Public faq', 'Visible outside', 'en', 'published', 'public')
    `,
    [publicKnowledgeA, fixture.orgA, fixture.propertyA],
  );

  await client.query(
    `
      insert into public.property_media (
        id, organization_id, property_id, media_type, role, storage_path, visibility
      ) values (
        $1, $2, $3, 'image', 'gallery',
        $4, 'private'
      )
    `,
    [
      privateMediaA,
      fixture.orgA,
      fixture.propertyA,
      `organizations/${fixture.orgA}/properties/${fixture.propertyA}/media/${privateMediaA}.png`,
    ],
  );
}, 30_000);

afterAll(async () => {
  await client?.end();
});

describe("public experience isolation", () => {
  it("does not let a public org portfolio read another org's homes", async () => {
    const result = await client.query<{ get_public_operator_portfolio: Record<string, unknown> }>(
      "select public.get_public_operator_portfolio($1)",
      ["riad-atlas"],
    );
    const payload = result.rows[0]?.get_public_operator_portfolio;
    const properties = payload?.properties as Array<{ slug: string; name: string }>;

    expect(payload?.status).toBe("ok");
    expect(properties.map((row) => row.slug)).toContain("riad-suite");
    expect(properties.map((row) => row.slug)).not.toContain("villa-one");
    expect(properties.map((row) => row.slug)).not.toContain("hidden-suite");
    expect(JSON.stringify(payload)).not.toContain(fixture.orgB);
    expect(JSON.stringify(payload)).not.toContain("Villa One");
  });

  it("does not resolve a property slug across organizations", async () => {
    const result = await client.query<{ get_public_property_showcase: Record<string, unknown> }>(
      "select public.get_public_property_showcase($1, $2)",
      ["riad-atlas", "villa-one"],
    );

    expect(result.rows[0]?.get_public_property_showcase.status).toBe("property_not_found");
  });

  it("hides draft or unlisted properties from the public showcase", async () => {
    const result = await client.query<{ get_public_property_showcase: Record<string, unknown> }>(
      "select public.get_public_property_showcase($1, $2)",
      ["riad-atlas", "hidden-suite"],
    );

    expect(result.rows[0]?.get_public_property_showcase.status).toBe("not_public");
  });

  it("never returns private, guest-only, lockbox, or internal identifier fields", async () => {
    const result = await client.query<{ get_public_property_showcase: Record<string, unknown> }>(
      "select public.get_public_property_showcase($1, $2)",
      ["riad-atlas", "riad-suite"],
    );
    const payload = result.rows[0]?.get_public_property_showcase;
    const serialized = JSON.stringify(payload);

    expect(payload?.status).toBe("ok");
    expect(serialized).toContain("Near the medina");
    expect(serialized).toContain("Visible outside");
    expect(serialized).not.toContain("atlas-secret-wifi");
    expect(serialized).not.toContain("Code 1111");
    expect(serialized).not.toContain("Owner only");
    expect(serialized).not.toContain("ATLAS-PRIVATE");
    expect(serialized).not.toMatch(/internalIdentifier":\s*"/);
    expect(serialized).not.toContain("lockbox");
    expect(serialized).not.toContain("smart_lock");
  });

  it("does not authorize private media or media from another property", async () => {
    const ownPrivate = await client.query<{ authorize_public_property_media: string | null }>(
      "select public.authorize_public_property_media($1, $2, $3)",
      ["riad-atlas", "riad-suite", privateMediaA],
    );
    const crossOrg = await client.query<{ authorize_public_property_media: string | null }>(
      "select public.authorize_public_property_media($1, $2, $3)",
      ["riad-atlas", "riad-suite", randomUUID()],
    );
    const crossSlug = await client.query<{ authorize_public_property_media: string | null }>(
      "select public.authorize_public_property_media($1, $2, $3)",
      ["luxury-villas", "riad-suite", privateMediaA],
    );

    expect(ownPrivate.rows[0]?.authorize_public_property_media).toBeNull();
    expect(crossOrg.rows[0]?.authorize_public_property_media).toBeNull();
    expect(crossSlug.rows[0]?.authorize_public_property_media).toBeNull();
  });

  it("does not grant anonymous users general table access", async () => {
    await asAnon(client, async () => {
      await expect(client.query("select id from public.properties")).rejects.toThrow();
      await expect(client.query("select body from public.property_content")).rejects.toThrow();
      await expect(client.query("select token_hash from public.guest_portal_tokens")).rejects.toThrow();
    });
  });

  it("lets staff remain unable to write listed property fields", async () => {
    await asAuthenticated(client, fixture.staffA, async () => {
      const result = await client.query(
        "update public.properties set is_listed_publicly = false where id = $1",
        [fixture.propertyA],
      );
      expect(result.rowCount).toBe(0);
    });
  });
});
