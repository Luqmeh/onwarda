import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("commercial signup authorization", () => {
  it("validates plans server-side and never activates a subscription from the client", () => {
    const actions = readFileSync(join(process.cwd(), "src/lib/commercial/actions.ts"), "utf8");
    const rpc = readFileSync(
      join(process.cwd(), "supabase/migrations/20260905030000_commercial_funnel.sql"),
      "utf8",
    );

    expect(actions).toContain("isSelectableCommercialPlan");
    expect(actions).toContain("complete_commercial_onboarding");
    expect(actions).not.toContain('formData.get("organizationId")');
    expect(actions).not.toContain('formData.get("userId")');
    expect(actions).not.toContain("status: \"active\"");
    const onboardingRpc = rpc.slice(
      rpc.indexOf("create or replace function public.complete_commercial_onboarding"),
      rpc.indexOf("create table public.commercial_inquiries"),
    );

    expect(onboardingRpc).toContain("status = 'pending'");
    expect(onboardingRpc).toContain("'pending'");
    expect(onboardingRpc).toMatch(
      /insert into public.organization_subscriptions[\s\S]{0,220}'pending'/,
    );
    expect(onboardingRpc).not.toMatch(
      /insert into public.organization_subscriptions[\s\S]{0,220}'active'/,
    );
    expect(onboardingRpc).toContain("from public.platform_admins");
    expect(onboardingRpc).toContain("'forbidden'");
    expect(onboardingRpc).toContain("v_user_id := auth.uid()");
  });

  it("does not let marketing pages assign platform-admin privileges", () => {
    const actions = readFileSync(join(process.cwd(), "src/lib/commercial/actions.ts"), "utf8");

    expect(actions).not.toContain("platform_admins");
    expect(actions).not.toContain("super_admin");
  });
});
