import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";

import { asAuthenticated, requireLocalPostgres } from "./postgres";
import { insertAuthUser, seedRlsFixture, type RlsFixture } from "./seed";

let client: Client;
let fixture: RlsFixture;
let freshUser: string;

beforeAll(async () => {
  client = await requireLocalPostgres();
  fixture = await seedRlsFixture(client);
  freshUser = await insertAuthUser(client, "commercial-signup@onwarda-rls.test");
}, 30_000);

afterAll(async () => {
  await client?.end();
});

describe("commercial onboarding", () => {
  it("creates a pending subscription from the signed-in user only", async () => {
    await asAuthenticated(client, freshUser, async () => {
      const result = await client.query<{ complete_commercial_onboarding: Record<string, unknown> }>(
        "select public.complete_commercial_onboarding($1, $2, $3)",
        ["Atlas Stays", "starter", "+212600000000"],
      );
      const payload = result.rows[0]?.complete_commercial_onboarding;

      expect(payload?.status).toBe("ok");
      expect(payload?.subscriptionStatus).toBe("pending");

      const subscription = await client.query<{ plan: string; status: string }>(
        `
          select s.plan, s.status
          from public.organization_subscriptions s
          join public.organization_users ou on ou.organization_id = s.organization_id
          where ou.user_id = $1
        `,
        [freshUser],
      );

      expect(subscription.rows[0]?.plan).toBe("starter");
      expect(subscription.rows[0]?.status).toBe("pending");
      expect(subscription.rows[0]?.status).not.toBe("active");
    });
  });

  it("rejects an unknown plan and does not create an organization for another user", async () => {
    await asAuthenticated(client, freshUser, async () => {
      const invalid = await client.query<{ complete_commercial_onboarding: Record<string, unknown> }>(
        "select public.complete_commercial_onboarding($1, $2, $3)",
        ["Should Not Exist", "agency", null],
      );
      expect(invalid.rows[0]?.complete_commercial_onboarding.status).toBe("invalid_plan");
    });

    await asAuthenticated(client, fixture.userA, async () => {
      const existing = await client.query<{ complete_commercial_onboarding: Record<string, unknown> }>(
        "select public.complete_commercial_onboarding($1, $2, $3)",
        ["Hijack Org", "professional", null],
      );
      const payload = existing.rows[0]?.complete_commercial_onboarding;
      expect(payload?.existing).toBe(true);
      expect(payload?.organizationId).toBe(fixture.orgA);
    });
  });

  it("does not let a client mark their subscription active through the commercial RPC", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      await client.query("select public.complete_commercial_onboarding($1, $2, $3)", [
        "Riad Atlas",
        "enterprise",
        null,
      ]);

      const row = await client.query<{ status: string }>(
        "select status from public.organization_subscriptions where organization_id = $1",
        [fixture.orgA],
      );
      expect(row.rows[0]?.status).not.toBe("active");
    });
  });
});
