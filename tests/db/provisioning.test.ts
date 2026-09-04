import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";

import { asAnon, asAuthenticated, requireLocalPostgres } from "./postgres";
import { insertAuthUser, seedRlsFixture, type RlsFixture } from "./seed";

let client: Client;
let fixture: RlsFixture;

beforeAll(async () => {
  client = await requireLocalPostgres();
  await client.query(`
    delete from public.organization_users
      where user_id in (select id from public.profiles where email like '%@onwarda-provision.test');
    delete from public.profiles where email like '%@onwarda-provision.test';
    delete from auth.users where email like '%@onwarda-provision.test';
  `);
  fixture = await seedRlsFixture(client);
}, 30_000);

afterAll(async () => {
  await client?.query(
    `
      delete from public.organization_users
      where user_id in (select id from public.profiles where email like '%@onwarda-provision.test');
      delete from public.profiles where email like '%@onwarda-provision.test';
      delete from auth.users where email like '%@onwarda-provision.test';
    `,
  );
  await client?.end();
});

describe("platform-admin provisioning RPC", () => {
  it("prevents a client user from creating an organization", async () => {
    const ownerId = await insertAuthUser(client, `owner-${randomUUID()}@onwarda-provision.test`);

    await asAuthenticated(client, fixture.userA, async () => {
      await expect(
        client.query(
          `
            select public.provision_organization(
              'Forbidden Org',
              $1,
              'active',
              $2,
              'invited',
              'owner@onwarda-provision.test'
            )
          `,
          [`forbidden-${randomUUID().slice(0, 8)}`, ownerId],
        ),
      ).rejects.toThrow(/not authorized|permission denied/i);
    });
  });

  it("prevents a client user from changing organization status", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      await expect(
        client.query(
          "select public.set_organization_status($1, 'suspended')",
          [fixture.orgB],
        ),
      ).rejects.toThrow(/not authorized|permission denied/i);
    });
  });

  it("prevents anonymous callers from provisioning or inviting owners", async () => {
    await asAnon(client, async () => {
      await expect(
        client.query(
          `
            select public.provision_organization(
              'Anon Org',
              'anon-org',
              'active',
              $1,
              'invited',
              'anon@onwarda-provision.test'
            )
          `,
          [fixture.userA],
        ),
      ).rejects.toThrow(/not authorized|permission denied/i);
    });
  });

  it("lets a platform admin create an organization with an owner membership", async () => {
    const ownerId = await insertAuthUser(
      client,
      `owner-${randomUUID()}@onwarda-provision.test`,
    );
    const slug = `provisioned-${randomUUID().slice(0, 8)}`;

    await asAuthenticated(client, fixture.platformAdmin, async () => {
      const created = await client.query<{ provision_organization: string }>(
        `
          select public.provision_organization(
            'Provisioned Riad',
            $1,
            'active',
            $2,
            'invited',
            'owner@onwarda-provision.test'
          )
        `,
        [slug, ownerId],
      );

      const organizationId = created.rows[0]?.provision_organization;
      expect(organizationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );

      await client.query("reset role");

      const organization = await client.query<{
        name: string;
        slug: string;
        status: string;
      }>(
        "select name, slug, status from public.organizations where id = $1",
        [organizationId],
      );
      expect(organization.rows[0]).toEqual({
        name: "Provisioned Riad",
        slug,
        status: "active",
      });

      const branding = await client.query<{ display_name: string | null }>(
        "select display_name from public.organization_branding where organization_id = $1",
        [organizationId],
      );
      expect(branding.rows[0]?.display_name).toBe("Provisioned Riad");

      const membership = await client.query<{ role: string; status: string }>(
        `
          select role, status
          from public.organization_users
          where organization_id = $1 and user_id = $2
        `,
        [organizationId, ownerId],
      );
      expect(membership.rows).toEqual([{ role: "owner", status: "invited" }]);

      const audit = await client.query<{ action: string }>(
        `
          select action
          from public.audit_logs
          where organization_id = $1
          order by created_at
        `,
        [organizationId],
      );
      expect(audit.rows.map((row) => row.action)).toEqual([
        "organization.created",
        "organization.owner_invited",
      ]);
    });
  });

  it("does not let a platform admin silently treat a suspended organization as active", async () => {
    const ownerId = await insertAuthUser(
      client,
      `owner-${randomUUID()}@onwarda-provision.test`,
    );
    const slug = `suspended-${randomUUID().slice(0, 8)}`;

    await asAuthenticated(client, fixture.platformAdmin, async () => {
      const created = await client.query<{ provision_organization: string }>(
        `
          select public.provision_organization(
            'Suspended Riad',
            $1,
            'active',
            $2,
            'invited',
            'owner@onwarda-provision.test'
          )
        `,
        [slug, ownerId],
      );
      const organizationId = created.rows[0]?.provision_organization;

      await client.query("select public.set_organization_status($1, 'suspended')", [
        organizationId,
      ]);

      const directUpdate = await client.query(
        "update public.organizations set status = 'active' where id = $1",
        [organizationId],
      );
      expect(directUpdate.rowCount).toBe(0);

      await client.query("reset role");

      const stillSuspended = await client.query<{ status: string }>(
        "select status from public.organizations where id = $1",
        [organizationId],
      );
      expect(stillSuspended.rows[0]?.status).toBe("suspended");

      await client.query("set local role authenticated");
      await client.query("select public.set_organization_status($1, 'active')", [
        organizationId,
      ]);

      await client.query("reset role");
      const activated = await client.query<{ status: string }>(
        "select status from public.organizations where id = $1",
        [organizationId],
      );
      expect(activated.rows[0]?.status).toBe("active");
    });
  });
});
