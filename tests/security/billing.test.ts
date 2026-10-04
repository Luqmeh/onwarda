import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { TenantIsolationError, ValidationError } from "@/lib/errors";

vi.mock("@/lib/tenancy/context", () => ({
  requireOrganizationRole: vi.fn(),
}));

vi.mock("@/lib/tenancy/workspace-access", () => ({
  requireWorkspaceView: vi.fn(),
}));

vi.mock("@/lib/database/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/authorization/platform-admin", () => ({
  requirePlatformAdmin: vi.fn(),
}));

vi.mock("@/lib/database/admin", () => ({
  createServiceRoleClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

import { requireOrganizationRole } from "@/lib/tenancy/context";
import { requireWorkspaceView } from "@/lib/tenancy/workspace-access";
import { createSupabaseServerClient } from "@/lib/database/server";
import { requirePlatformAdmin } from "@/lib/authorization/platform-admin";
import {
  getWorkspaceBillingSnapshot,
  requestPlanChange,
  selectPlan,
} from "@/lib/billing/service";
import {
  requestBillingPlanChangeAction,
  selectBillingPlanAction,
} from "@/lib/billing/actions";
import { setOrganizationSubscriptionAction } from "@/lib/admin/subscriptions";

const orgA = "11111111-1111-4111-8111-111111111111";
const orgB = "22222222-2222-4222-8222-222222222222";

function walkSource(directory: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...walkSource(fullPath));
      continue;
    }

    if (fullPath.endsWith(".ts") || fullPath.endsWith(".tsx")) {
      files.push(fullPath);
    }
  }

  return files;
}

function createQuery(result: unknown) {
  const builder: Record<string, unknown> = {};
  const self = () => builder;
  builder.select = vi.fn(self);
  builder.eq = vi.fn(self);
  builder.order = vi.fn(self);
  builder.limit = vi.fn(self);
  builder.maybeSingle = vi.fn(async () => result);
  builder.then = (
    onFulfilled: (value: unknown) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(onFulfilled, onRejected);
  return builder;
}

describe("billing access isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads billing only for the server-derived organization", async () => {
    const subscription = createQuery({
      data: {
        id: randomUUID(),
        organization_id: orgA,
        plan: "professional",
        status: "pending",
        billing_interval: "month",
        started_at: new Date().toISOString(),
        renews_at: null,
        cancelled_at: null,
        requested_plan: null,
        cancellation_requested_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      error: null,
    });
    const history = createQuery({ data: [], error: null });
    const properties = createQuery({ count: 2, error: null });
    const from = vi.fn((table: string) => {
      if (table === "organization_subscriptions") return subscription;
      if (table === "organization_subscription_events") return history;
      return properties;
    });

    vi.mocked(requireWorkspaceView).mockResolvedValue({
      kind: "membership",
      context: {
        organization: { id: orgA, name: "Riad Atlas" },
        membership: { role: "owner" },
      },
    } as never);
    vi.mocked(createSupabaseServerClient).mockResolvedValue({ from } as never);

    const snapshot = await getWorkspaceBillingSnapshot();
    expect(snapshot.organizationId).toBe(orgA);
    expect(snapshot.subscription?.organization_id).toBe(orgA);
    expect(snapshot.activePropertyCount).toBe(2);
    expect(snapshot.status.label).toBe("Payment setup pending");
    expect(subscription.eq).toHaveBeenCalledWith("organization_id", orgA);
    expect(properties.eq).toHaveBeenCalledWith("status", "active");
  });

  it("does not let a client invent a plan, price, or active status", async () => {
    vi.mocked(requireOrganizationRole).mockResolvedValue({
      organization: { id: orgA },
      membership: { role: "owner" },
    } as never);

    await expect(selectPlan("invented")).rejects.toBeInstanceOf(ValidationError);
    await expect(selectPlan("free")).rejects.toBeInstanceOf(ValidationError);
    await expect(requestPlanChange("hidden-plan")).rejects.toBeInstanceOf(ValidationError);

    const invented = await selectBillingPlanAction(
      {},
      { get: (name: string) => (name === "plan" ? "invented" : "") } as FormData,
    );
    expect(invented).toEqual({ error: "Choose a published Onwarda plan." });

    const hidden = await requestBillingPlanChangeAction(
      {},
      { get: (name: string) => (name === "plan" ? "free" : "") } as FormData,
    );
    expect(hidden).toEqual({ error: "Choose a published Onwarda plan." });
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("does not let staff modify billing", async () => {
    vi.mocked(requireOrganizationRole).mockRejectedValue(new TenantIsolationError());

    await expect(selectPlan("starter")).rejects.toBeInstanceOf(TenantIsolationError);
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("does not let a client activate a subscription or change organization_id", async () => {
    const source = readFileSync(join(process.cwd(), "src/lib/billing/actions.ts"), "utf8");
    const service = readFileSync(join(process.cwd(), "src/lib/billing/service.ts"), "utf8");
    const forms = readFileSync(
      join(process.cwd(), "src/components/workspace/billing-forms.tsx"),
      "utf8",
    );

    expect(source).not.toContain("organizationId");
    expect(source).not.toContain("status");
    expect(source).not.toContain("active");
    expect(source).not.toContain("price");
    expect(forms).not.toContain("organizationId");
    expect(forms).not.toContain('name="status"');
    expect(forms).not.toContain('name="price"');
    expect(service).toContain("requireOrganizationRole");
    expect(service).toContain("customer_request_subscription_plan_change");
    expect(service).not.toContain("admin_set_organization_subscription");
    expect(service).not.toContain("createServiceRoleClient");
  });

  it("lets a platform admin perform an authorized manual action", async () => {
    vi.mocked(requirePlatformAdmin).mockResolvedValue({ user: { id: randomUUID() } } as never);
    const rpc = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createSupabaseServerClient).mockResolvedValue({ rpc } as never);

    await expect(
      setOrganizationSubscriptionAction(
        {},
        {
          get: (name: string) => {
            if (name === "organizationId") return orgB;
            if (name === "plan") return "starter";
            if (name === "status") return "suspended";
            if (name === "billingInterval") return "month";
            return "";
          },
        } as FormData,
      ),
    ).rejects.toThrow();

    expect(requirePlatformAdmin).toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith(
      "admin_set_organization_subscription",
      expect.objectContaining({
        p_organization_id: orgB,
        p_status: "suspended",
        p_plan: "starter",
      }),
    );
  });
});

describe("billing source isolation", () => {
  it("keeps service role and payment credentials out of the client bundle", () => {
    const files = [
      ...walkSource(join(process.cwd(), "src/lib/billing")),
      join(process.cwd(), "src/components/workspace/billing-forms.tsx"),
      join(process.cwd(), "src/app/app/billing/page.tsx"),
    ];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
      expect(source, file).not.toContain("createServiceRoleClient");
      expect(source, file).not.toContain("STRIPE_SECRET");
      expect(source, file).not.toContain("PAYZONE");
      expect(source, file).not.toContain("CMI_");
      expect(source, file).not.toContain("card_number");
      expect(source, file).not.toMatch(/payment[_-]?credential/i);
    }
  });

  it("does not install or import a payment processor", () => {
    const pkg = readFileSync(join(process.cwd(), "package.json"), "utf8");
    expect(pkg).not.toMatch(/stripe|payzone|cmi|paypal/i);

    const types = readFileSync(join(process.cwd(), "src/lib/billing/types.ts"), "utf8");
    const provider = readFileSync(join(process.cwd(), "src/lib/billing/provider.ts"), "utf8");
    expect(types).toContain("Payment provider not configured.");
    expect(provider).toContain("PAYMENT_PROVIDER_UNAVAILABLE");
    expect(provider).not.toContain("sk_live");
    expect(provider).not.toContain("process.env.STRIPE");
  });
});
