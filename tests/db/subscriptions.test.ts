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

describe("organization subscriptions", () => {
  it("prevents a client user from inserting subscription records", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      await expect(
        client.query(
          `
            insert into public.organization_subscriptions (
              organization_id, plan, status, billing_interval
            ) values ($1, 'starter', 'active', 'month')
          `,
          [fixture.orgA],
        ),
      ).rejects.toThrow(/permission denied|row-level security/i);
    });
  });

  it("prevents a client user from updating subscription records", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      await expect(
        client.query(
          `
            update public.organization_subscriptions
            set plan = 'enterprise'
            where organization_id = $1
          `,
          [fixture.orgA],
        ),
      ).rejects.toThrow(/permission denied|row-level security/i);
    });
  });

  it("prevents a client user from calling the admin subscription RPC", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      await expect(
        client.query(
          `
            select public.admin_set_organization_subscription(
              $1, 'starter', 'active', 'month', now(), now() + interval '30 days', null
            )
          `,
          [fixture.orgA],
        ),
      ).rejects.toThrow(/not authorized|permission denied/i);
    });
  });

  it("lets a platform admin set a subscription and writes an audit log", async () => {
    await asAuthenticated(client, fixture.platformAdmin, async () => {
      const result = await client.query<{ admin_set_organization_subscription: string }>(
        `
          select public.admin_set_organization_subscription(
            $1, 'professional', 'trialing', 'year', now(), now() + interval '365 days', null
          )
        `,
        [fixture.orgA],
      );

      expect(result.rows[0]?.admin_set_organization_subscription).toBeTruthy();

      const stored = await client.query<{ plan: string; status: string }>(
        `
          select plan, status
          from public.organization_subscriptions
          where organization_id = $1
        `,
        [fixture.orgA],
      );
      expect(stored.rows[0]).toMatchObject({
        plan: "professional",
        status: "trialing",
      });

      const audit = await client.query<{ action: string }>(
        `
          select action
          from public.audit_logs
          where organization_id = $1
            and action = 'organization.subscription_updated'
        `,
        [fixture.orgA],
      );
      expect(audit.rowCount).toBeGreaterThan(0);
    });
  });
});
