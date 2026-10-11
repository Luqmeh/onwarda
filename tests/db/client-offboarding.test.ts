import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";

import { asAnon, asAuthenticated, requireLocalPostgres } from "./postgres";
import { insertAuthUser } from "./seed";

let client: Client;
let actorId: string;
let exclusiveId: string;
let sharedId: string;
let victimId: string;
let survivorId: string;

beforeAll(async () => {
  client = await requireLocalPostgres();
  actorId = await insertAuthUser(client, `offboard-admin-${randomUUID()}@onwarda.test`);
  exclusiveId = await insertAuthUser(client, `offboard-exclusive-${randomUUID()}@onwarda.test`);
  sharedId = await insertAuthUser(client, `offboard-shared-${randomUUID()}@onwarda.test`);
  victimId = randomUUID();
  survivorId = randomUUID();
  const suffix = randomUUID().slice(0, 8);

  await client.query(
    `
      insert into public.platform_admins (user_id, role, status)
      values ($1, 'super_admin', 'active')
    `,
    [actorId],
  );
  await client.query(
    `
      insert into public.organizations (id, name, slug, status)
      values
        ($1, 'Victim Stay', $2, 'active'),
        ($3, 'Survivor Stay', $4, 'active')
    `,
    [victimId, `victim-${suffix}`, survivorId, `survivor-${suffix}`],
  );
  await client.query(
    `
      insert into public.organization_users (organization_id, user_id, role, status)
      values
        ($1, $3, 'owner', 'active'),
        ($1, $4, 'staff', 'active'),
        ($1, $5, 'admin', 'active'),
        ($2, $4, 'owner', 'active')
    `,
    [victimId, survivorId, exclusiveId, sharedId, actorId],
  );
  await client.query(
    `
      insert into public.properties (organization_id, name, slug)
      values ($1, 'Victim House', 'house')
    `,
    [victimId],
  );
}, 30_000);

afterAll(async () => {
  if (client && survivorId) {
    await client.query(`delete from public.organization_users where organization_id = $1`, [survivorId]).catch(() => undefined);
    await client.query(`delete from public.organization_branding where organization_id = $1`, [survivorId]).catch(() => undefined);
    await client.query(`delete from public.organization_onboarding where organization_id = $1`, [survivorId]).catch(() => undefined);
    await client.query(`delete from public.organizations where id = $1`, [survivorId]).catch(() => undefined);
  }
  await client?.end();
});

describe("client offboarding purge", () => {
  it("does not let anon or a client user execute the purge", async () => {
    await expect(
      asAnon(client, () =>
        client.query(`select public.admin_purge_organization_data($1, $2)`, [victimId, actorId]),
      ),
    ).rejects.toThrow();

    await expect(
      asAuthenticated(client, exclusiveId, () =>
        client.query(`select public.admin_purge_organization_data($1, $2)`, [victimId, actorId]),
      ),
    ).rejects.toThrow();
  });

  it("refuses an actor who is not a platform administrator", async () => {
    await expect(
      client.query(`select public.admin_purge_organization_data($1, $2)`, [victimId, exclusiveId]),
    ).rejects.toThrow(/not authorized/);
  });

  it("removes only the selected organization and keeps shared accounts", async () => {
    const amenitiesBefore = await client.query(`select count(*)::int as count from public.amenity_definitions`);

    const result = await client.query<{ admin_purge_organization_data: { status: string } }>(
      `select public.admin_purge_organization_data($1, $2) as admin_purge_organization_data`,
      [victimId, actorId],
    );

    expect(result.rows[0]?.admin_purge_organization_data.status).toBe("removed");

    const victim = await client.query(`select id from public.organizations where id = $1`, [victimId]);
    const survivor = await client.query(`select id from public.organizations where id = $1`, [survivorId]);
    const sharedMembership = await client.query(
      `select organization_id from public.organization_users where user_id = $1`,
      [sharedId],
    );
    const exclusiveMembership = await client.query(
      `select id from public.organization_users where user_id = $1`,
      [exclusiveId],
    );
    const exclusiveAuth = await client.query(`select id from auth.users where id = $1`, [exclusiveId]);
    const adminStill = await client.query(
      `select user_id from public.platform_admins where user_id = $1 and status = 'active'`,
      [actorId],
    );
    const amenitiesAfter = await client.query(`select count(*)::int as count from public.amenity_definitions`);
    const audit = await client.query(
      `
        select organization_id, metadata
        from public.audit_logs
        where action = 'organization.permanently_deleted'
          and actor_user_id = $1
        order by created_at desc
        limit 1
      `,
      [actorId],
    );

    expect(victim.rowCount).toBe(0);
    expect(survivor.rowCount).toBe(1);
    expect(sharedMembership.rows.map((row) => row.organization_id)).toEqual([survivorId]);
    expect(exclusiveMembership.rowCount).toBe(0);
    expect(exclusiveAuth.rowCount).toBe(1);
    expect(adminStill.rowCount).toBe(1);
    expect(amenitiesAfter.rows[0]?.count).toBe(amenitiesBefore.rows[0]?.count);
    expect(audit.rows[0]?.organization_id).toBeNull();
    expect(JSON.stringify(audit.rows[0]?.metadata)).not.toContain("Victim");
  });
});
