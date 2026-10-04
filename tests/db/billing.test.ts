import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";

import { asAuthenticated, requireLocalPostgres } from "./postgres";
import { insertAuthUser, seedRlsFixture, type RlsFixture } from "./seed";

let client: Client;
let fixture: RlsFixture;
let managerA: string;
let subscriptionA: string;
let subscriptionB: string;

beforeAll(async () => {
  client = await requireLocalPostgres();
  fixture = await seedRlsFixture(client);
  managerA = await insertAuthUser(client, "manager-a@onwarda-rls.test");

  await client.query(
    `
      insert into public.organization_users (
        organization_id, user_id, role, status
      ) values ($1, $2, 'manager', 'active')
    `,
    [fixture.orgA, managerA],
  );

  const createdA = await client.query<{ id: string }>(
    `
      insert into public.organization_subscriptions (
        organization_id, plan, status, billing_interval
      ) values ($1, 'starter', 'pending', 'month')
      returning id
    `,
    [fixture.orgA],
  );
  const createdB = await client.query<{ id: string }>(
    `
      insert into public.organization_subscriptions (
        organization_id, plan, status, billing_interval
      ) values ($1, 'professional', 'pending', 'month')
      returning id
    `,
    [fixture.orgB],
  );

  subscriptionA = createdA.rows[0]!.id;
  subscriptionB = createdB.rows[0]!.id;
}, 30_000);

afterAll(async () => {
  await client?.end();
});

describe("billing tenancy", () => {
  it("prevents organization A from reading organization B subscription or history", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      const own = await client.query<{ id: string }>(
        "select id from public.organization_subscriptions where organization_id = $1",
        [fixture.orgA],
      );
      expect(own.rows[0]?.id).toBe(subscriptionA);

      const foreign = await client.query<{ id: string }>(
        "select id from public.organization_subscriptions where organization_id = $1",
        [fixture.orgB],
      );
      expect(foreign.rowCount).toBe(0);

      const foreignById = await client.query<{ id: string }>(
        "select id from public.organization_subscriptions where id = $1",
        [subscriptionB],
      );
      expect(foreignById.rowCount).toBe(0);
    });
  });

  it("prevents organization A from modifying organization B subscription or history", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      await expect(
        client.query(
          "update public.organization_subscriptions set plan = 'enterprise' where id = $1",
          [subscriptionB],
        ),
      ).rejects.toThrow(/permission denied|row-level security/i);
    });

    await asAuthenticated(client, fixture.userA, async () => {
      await expect(
        client.query(
          `
            insert into public.organization_subscription_events (
              organization_id, subscription_id, event_type, source
            ) values ($1, $2, 'subscription.plan_selected', 'customer')
          `,
          [fixture.orgB, subscriptionB],
        ),
      ).rejects.toThrow(/permission denied|row-level security/i);
    });
  });

  it("blocks subscription reparenting", async () => {
    await expect(
      client.query(
        "update public.organization_subscriptions set organization_id = $1 where id = $2",
        [fixture.orgB, subscriptionA],
      ),
    ).rejects.toThrow(/organization_id cannot be changed/i);
  });

  it("blocks cross-org history inserts and reparenting", async () => {
    await expect(
      client.query(
        `
          insert into public.organization_subscription_events (
            organization_id, subscription_id, event_type, source
          ) values ($1, $2, 'subscription.created', 'system')
        `,
        [fixture.orgB, subscriptionA],
      ),
    ).rejects.toThrow(/organization mismatch|violates/i);

    const event = await client.query<{ id: string }>(
      `
        insert into public.organization_subscription_events (
          organization_id, subscription_id, event_type, source
        ) values ($1, $2, 'subscription.created', 'system')
        returning id
      `,
      [fixture.orgA, subscriptionA],
    );

    await expect(
      client.query(
        "update public.organization_subscription_events set organization_id = $1 where id = $2",
        [fixture.orgB, event.rows[0]!.id],
      ),
    ).rejects.toThrow(/organization_id cannot be changed|organization mismatch/i);

    await asAuthenticated(client, fixture.userB, async () => {
      const visible = await client.query(
        "select id from public.organization_subscription_events where organization_id = $1",
        [fixture.orgA],
      );
      expect(visible.rowCount).toBe(0);
    });
  });
});

describe("billing mutations", () => {
  it("lets an owner request a pending plan change without activating the subscription", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      await client.query("select public.customer_request_subscription_plan_change($1)", [
        "professional",
      ]);

      const row = await client.query<{ plan: string; status: string; requested_plan: string | null }>(
        "select plan, status, requested_plan from public.organization_subscriptions where id = $1",
        [subscriptionA],
      );
      expect(row.rows[0]).toMatchObject({
        plan: "professional",
        status: "pending",
        requested_plan: null,
      });

      const history = await client.query<{ event_type: string; source: string }>(
        `
          select event_type, source
          from public.organization_subscription_events
          where subscription_id = $1
          order by created_at desc
        `,
        [subscriptionA],
      );
      expect(history.rows[0]).toMatchObject({
        event_type: "subscription.plan_selected",
        source: "customer",
      });
    });
  });

  it("stores an active plan change as a request and never lets the client set active", async () => {
    await client.query(
      "update public.organization_subscriptions set status = 'active', plan = 'starter' where id = $1",
      [subscriptionA],
    );

    await asAuthenticated(client, fixture.userA, async () => {
      await client.query("select public.customer_request_subscription_plan_change($1)", [
        "enterprise",
      ]);

      const row = await client.query<{ plan: string; status: string; requested_plan: string | null }>(
        "select plan, status, requested_plan from public.organization_subscriptions where id = $1",
        [subscriptionA],
      );
      expect(row.rows[0]).toMatchObject({
        plan: "starter",
        status: "active",
        requested_plan: "enterprise",
      });

      await expect(
        client.query(
          "update public.organization_subscriptions set status = 'active' where organization_id = $1",
          [fixture.orgA],
        ),
      ).rejects.toThrow(/permission denied|row-level security/i);
    });

    await client.query(
      "update public.organization_subscriptions set status = 'pending', requested_plan = null, plan = 'professional' where id = $1",
      [subscriptionA],
    );
  });

  it("rejects invented or unpublished plans from the customer RPC", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      await expect(
        client.query("select public.customer_request_subscription_plan_change($1)", ["free"]),
      ).rejects.toThrow(/invalid subscription plan/i);
    });

    await asAuthenticated(client, fixture.userA, async () => {
      await expect(
        client.query("select public.customer_request_subscription_plan_change($1)", ["agency"]),
      ).rejects.toThrow(/invalid subscription plan/i);
    });
  });

  it("prevents staff from changing billing while allowing manager read access", async () => {
    await asAuthenticated(client, fixture.staffA, async () => {
      const visible = await client.query(
        "select plan, status from public.organization_subscriptions where organization_id = $1",
        [fixture.orgA],
      );
      expect(visible.rowCount).toBe(1);

      await expect(
        client.query("select public.customer_request_subscription_plan_change($1)", [
          "enterprise",
        ]),
      ).rejects.toThrow(/not authorized|permission denied/i);
    });

    await asAuthenticated(client, managerA, async () => {
      const visible = await client.query(
        "select plan from public.organization_subscriptions where organization_id = $1",
        [fixture.orgA],
      );
      expect(visible.rowCount).toBe(1);

      await expect(
        client.query("select public.customer_request_subscription_cancellation()"),
      ).rejects.toThrow(/not authorized|permission denied/i);
    });
  });

  it("lets support read billing and not mutate it", async () => {
    const session = await client.query<{ id: string }>(
      `
        insert into public.support_sessions (
          organization_id, platform_admin_user_id, reason, expires_at
        ) values ($1, $2, 'billing review', now() + interval '1 hour')
        returning id
      `,
      [fixture.orgA, fixture.platformAdmin],
    );

    await asAuthenticated(client, fixture.platformAdmin, async () => {
      const visible = await client.query(
        "select id from public.organization_subscriptions where organization_id = $1",
        [fixture.orgA],
      );
      expect(visible.rowCount).toBe(1);

      await expect(
        client.query("select public.customer_request_subscription_plan_change($1)", [
          "starter",
        ]),
      ).rejects.toThrow(/not authorized|permission denied/i);
    });

    await client.query("update public.support_sessions set ended_at = now() where id = $1", [
      session.rows[0]!.id,
    ]);
  });

  it("lets a platform admin change status and writes audit plus history", async () => {
    await asAuthenticated(client, fixture.platformAdmin, async () => {
      await client.query(
        `
          select public.admin_set_organization_subscription(
            $1, 'professional', 'suspended', 'month', now(), null, null
          )
        `,
        [fixture.orgA],
      );

      const stored = await client.query<{ status: string }>(
        "select status from public.organization_subscriptions where organization_id = $1",
        [fixture.orgA],
      );
      expect(stored.rows[0]?.status).toBe("suspended");

      const history = await client.query<{ event_type: string; source: string }>(
        `
          select event_type, source
          from public.organization_subscription_events
          where organization_id = $1
            and event_type = 'subscription.suspended'
        `,
        [fixture.orgA],
      );
      expect(history.rows[0]).toMatchObject({
        event_type: "subscription.suspended",
        source: "admin",
      });

      const audit = await client.query(
        `
          select id
          from public.audit_logs
          where organization_id = $1
            and action = 'organization.subscription_updated'
        `,
        [fixture.orgA],
      );
      expect(audit.rowCount).toBeGreaterThan(0);
    });

    await client.query(
      "update public.organization_subscriptions set status = 'pending' where organization_id = $1",
      [fixture.orgA],
    );
  });

  it("keeps a pending subscription pending without a payment event", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      await client.query("select public.customer_request_subscription_plan_change($1)", [
        "starter",
      ]);
      await client.query("select public.customer_request_subscription_cancellation()");

      const row = await client.query<{
        status: string;
        cancellation_requested_at: string | null;
      }>(
        "select status, cancellation_requested_at from public.organization_subscriptions where organization_id = $1",
        [fixture.orgA],
      );
      expect(row.rows[0]?.status).toBe("pending");
      expect(row.rows[0]?.cancellation_requested_at).toBeTruthy();

      await client.query("select public.customer_reactivate_subscription()");
      const after = await client.query<{
        status: string;
        cancellation_requested_at: string | null;
      }>(
        "select status, cancellation_requested_at from public.organization_subscriptions where organization_id = $1",
        [fixture.orgA],
      );
      expect(after.rows[0]?.status).toBe("pending");
      expect(after.rows[0]?.cancellation_requested_at).toBeNull();
    });
  });

  it("supports provider_event_id idempotency without fabricating provider events", async () => {
    const first = await client.query<{ id: string }>(
      `
        select public.record_organization_subscription_event(
          $1, $2, 'subscription.status_changed', 'pending', 'pending',
          'starter', 'starter', 'system', null, '{}'::jsonb, 'future-provider-event-1'
        ) as id
      `,
      [fixture.orgA, subscriptionA],
    );
    const second = await client.query<{ id: string }>(
      `
        select public.record_organization_subscription_event(
          $1, $2, 'subscription.status_changed', 'pending', 'pending',
          'starter', 'starter', 'system', null, '{}'::jsonb, 'future-provider-event-1'
        ) as id
      `,
      [fixture.orgA, subscriptionA],
    );

    expect(first.rows[0]?.id).toBe(second.rows[0]?.id);

    const count = await client.query<{ count: string }>(
      `
        select count(*)::text as count
        from public.organization_subscription_events
        where provider_event_id = 'future-provider-event-1'
      `,
    );
    expect(count.rows[0]?.count).toBe("1");
  });
});
