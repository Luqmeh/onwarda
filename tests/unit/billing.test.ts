import { describe, expect, it } from "vitest";

import { getCommercialPlan, isSelectableCommercialPlan } from "@/config/pricing";
import { calculatePlanPrice, formatIndicativePrice } from "@/lib/billing/plans";
import {
  getPaymentProvider,
  UnavailablePaymentProvider,
  PaymentProviderUnavailableError,
} from "@/lib/billing/provider";
import {
  canCustomerChangePlan,
  customerPlanChangeAppliesImmediately,
  doesBillingRestrictWorkspace,
  isActivatedSubscriptionStatus,
  isPendingSetupStatus,
  projectBillingStatus,
  subscriptionStatusLabel,
} from "@/lib/billing/status";
import { PAYMENT_PROVIDER_UNAVAILABLE } from "@/lib/billing/types";
import { customerPlanChangeSchema } from "@/lib/validation/billing";

describe("plan validation", () => {
  it("accepts published plans and rejects invented or hidden plans", () => {
    expect(isSelectableCommercialPlan("starter")).toBe(true);
    expect(isSelectableCommercialPlan("professional")).toBe(true);
    expect(isSelectableCommercialPlan("enterprise")).toBe(true);
    expect(isSelectableCommercialPlan("free")).toBe(false);
    expect(isSelectableCommercialPlan("hidden-plan")).toBe(false);
    expect(isSelectableCommercialPlan("agency")).toBe(false);
    expect(getCommercialPlan("free")?.status).toBe("hidden");
    expect(customerPlanChangeSchema.safeParse({ plan: "starter" }).success).toBe(true);
    expect(customerPlanChangeSchema.safeParse({ plan: "free" }).success).toBe(false);
    expect(customerPlanChangeSchema.safeParse({ plan: "invented" }).success).toBe(false);
  });
});

describe("price calculation", () => {
  it("uses canonical pricing and a server-supplied active-property count", () => {
    expect(calculatePlanPrice({ planId: "starter", activePropertyCount: 2 })).toMatchObject({
      baseAmount: 299,
      variableAmount: 0,
      indicativeTotal: 299,
      indicative: true,
      currency: "MAD",
    });

    expect(calculatePlanPrice({ planId: "professional", activePropertyCount: 4 })).toMatchObject({
      baseAmount: 699,
      perPropertyAmount: 39,
      variableAmount: 156,
      indicativeTotal: 855,
    });

    expect(calculatePlanPrice({ planId: "enterprise", activePropertyCount: 10 })).toMatchObject({
      baseAmount: 1290,
      perPropertyAmount: 29,
      variableAmount: 290,
      indicativeTotal: 1580,
    });
  });

  it("rejects hidden plans, invented plans, and invalid counts", () => {
    expect(() => calculatePlanPrice({ planId: "free", activePropertyCount: 1 })).toThrow(
      /published Onwarda plan/i,
    );
    expect(() => calculatePlanPrice({ planId: "invented", activePropertyCount: 1 })).toThrow(
      /published Onwarda plan/i,
    );
    expect(() => calculatePlanPrice({ planId: "starter", activePropertyCount: -1 })).toThrow(
      /non-negative/i,
    );
    expect(() => calculatePlanPrice({ planId: "starter", activePropertyCount: 1.5 })).toThrow(
      /non-negative/i,
    );
  });

  it("labels the projection as indicative", () => {
    const projection = calculatePlanPrice({ planId: "professional", activePropertyCount: 1 });
    expect(formatIndicativePrice(projection)).toContain("indicative");
    expect(formatIndicativePrice(projection)).not.toMatch(/invoice|charged|paid/i);
  });
});

describe("subscription state transitions", () => {
  it("keeps pending as the commercial signup state", () => {
    expect(isPendingSetupStatus("pending")).toBe(true);
    expect(isActivatedSubscriptionStatus("pending")).toBe(false);
    expect(customerPlanChangeAppliesImmediately("pending")).toBe(true);
    expect(doesBillingRestrictWorkspace("pending")).toBe(false);
    expect(subscriptionStatusLabel("pending")).toBe("Payment setup pending");
    expect(subscriptionStatusLabel("pending")).not.toMatch(/active/i);
  });

  it("treats plan changes on activated subscriptions as requests", () => {
    expect(customerPlanChangeAppliesImmediately("active")).toBe(false);
    expect(canCustomerChangePlan("active")).toBe(true);
    expect(canCustomerChangePlan("cancelled")).toBe(false);
    expect(isActivatedSubscriptionStatus("active")).toBe(true);
  });

  it("projects cancellation as a request until completed", () => {
    const requested = projectBillingStatus({
      status: "active",
      cancellationRequestedAt: "2026-09-23T00:00:00.000Z",
    });
    expect(requested.cancellationRequested).toBe(true);
    expect(requested.isActivated).toBe(true);
    expect(requested.label).not.toBe("Cancelled");

    const cancelled = projectBillingStatus({ status: "cancelled" });
    expect(cancelled.label).toBe("Cancelled");
    expect(cancelled.isActivated).toBe(false);
  });

  it("documents future payment-failure states without locking the workspace", () => {
    for (const status of ["past_due", "grace_period", "suspended", "paused"] as const) {
      const projection = projectBillingStatus({ status });
      expect(projection.restrictsWorkspace).toBe(false);
      expect(doesBillingRestrictWorkspace(status)).toBe(false);
      expect(projection.description).toMatch(/future payment-failure|reserved/i);
    }
  });
});

describe("billing projection", () => {
  it("never claims a payment succeeded for a pending subscription", () => {
    const pending = projectBillingStatus({ status: "pending" });
    expect(pending.label).toBe("Payment setup pending");
    expect(pending.description).toMatch(/waiting for payment configuration/i);
    expect(pending.nextStep).toMatch(/billing is configured/i);
    expect(JSON.stringify(pending)).not.toMatch(/payment successful|you're subscribed|next payment/i);
  });
});

describe("unavailable payment provider", () => {
  it("reports that no provider is configured and never fakes success", async () => {
    const provider = getPaymentProvider();
    expect(provider).toBeInstanceOf(UnavailablePaymentProvider);

    await expect(
      provider.createCheckout({
        organizationId: "11111111-1111-4111-8111-111111111111",
        planId: "starter",
        successUrl: "https://example.com/ok",
        cancelUrl: "https://example.com/cancel",
      }),
    ).rejects.toBeInstanceOf(PaymentProviderUnavailableError);

    await expect(provider.retrieveCheckout("checkout_1")).rejects.toMatchObject({
      message: PAYMENT_PROVIDER_UNAVAILABLE,
    });
    await expect(provider.cancelSubscription("org")).rejects.toThrow(PAYMENT_PROVIDER_UNAVAILABLE);
    await expect(
      provider.changeSubscription({ organizationId: "org", planId: "professional" }),
    ).rejects.toThrow(PAYMENT_PROVIDER_UNAVAILABLE);
    await expect(provider.getCustomer("org")).rejects.toThrow(PAYMENT_PROVIDER_UNAVAILABLE);
    await expect(
      provider.verifyWebhook({ payload: "{}", signature: "sig" }),
    ).rejects.toThrow(PAYMENT_PROVIDER_UNAVAILABLE);
  });
});
