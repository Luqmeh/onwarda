import type { BillingStatusProjection } from "@/lib/billing/types";
import type { OrganizationSubscriptionStatus } from "@/types/enums";

const ACTIVATED_STATUSES = new Set<OrganizationSubscriptionStatus>([
  "active",
  "trialing",
]);

const FUTURE_PROVIDER_FAILURE_STATUSES = new Set<OrganizationSubscriptionStatus>([
  "past_due",
  "grace_period",
  "suspended",
  "paused",
]);

export function isActivatedSubscriptionStatus(
  status: OrganizationSubscriptionStatus | null | undefined,
) {
  return Boolean(status && ACTIVATED_STATUSES.has(status));
}

export function isPendingSetupStatus(
  status: OrganizationSubscriptionStatus | null | undefined,
) {
  return status === "pending" || !status;
}

export function doesBillingRestrictWorkspace(
  status: OrganizationSubscriptionStatus | null | undefined,
) {
  void status;
  // Phase 6A: pending is not suspended. Workspace access stays open for
  // onboarding and testing. Future production policy may restrict suspended
  // or cancelled accounts after a payment provider exists.
  return false;
}

export function subscriptionStatusLabel(
  status: OrganizationSubscriptionStatus | null | undefined,
) {
  switch (status) {
    case "pending":
      return "Payment setup pending";
    case "trialing":
      return "Trial (manual)";
    case "active":
      return "Active";
    case "past_due":
      return "Past due";
    case "grace_period":
      return "Grace period";
    case "suspended":
      return "Suspended";
    case "paused":
      return "Paused";
    case "cancelled":
      return "Cancelled";
    default:
      return "No subscription record";
  }
}

export function projectBillingStatus(input: {
  status: OrganizationSubscriptionStatus | null;
  cancellationRequestedAt?: string | null;
}): BillingStatusProjection {
  const cancellationRequested = Boolean(input.cancellationRequestedAt);
  const status = input.status;

  if (!status || status === "pending") {
    return {
      status,
      label: "Payment setup pending",
      description:
        "Your Onwarda subscription is set up and waiting for payment configuration.",
      nextStep:
        "Your account is ready. Payment activation will be available once billing is configured.",
      isPendingSetup: true,
      isActivated: false,
      cancellationRequested,
      restrictsWorkspace: false,
    };
  }

  if (status === "cancelled") {
    return {
      status,
      label: "Cancelled",
      description: "This subscription is cancelled. The record is kept for history.",
      nextStep: "A platform administrator can restore access if needed. No refund is processed here.",
      isPendingSetup: false,
      isActivated: false,
      cancellationRequested,
      restrictsWorkspace: false,
    };
  }

  if (FUTURE_PROVIDER_FAILURE_STATUSES.has(status)) {
    return {
      status,
      label: subscriptionStatusLabel(status),
      description:
        "This state is reserved for future payment-failure handling. No provider has reported a payment event.",
      nextStep:
        "A future verified provider event can move a subscription to past due, grace period, or suspended.",
      isPendingSetup: false,
      isActivated: false,
      cancellationRequested,
      restrictsWorkspace: false,
    };
  }

  return {
    status,
    label: subscriptionStatusLabel(status),
    description: cancellationRequested
      ? "Cancellation has been requested. The subscription stays in its current state until an administrator completes it."
      : "This record was activated manually. Billing is not connected to a payment provider.",
    nextStep: cancellationRequested
      ? "You can withdraw the cancellation request, or a platform administrator can complete cancellation."
      : "Plan changes stay as requests until a payment provider can apply them.",
    isPendingSetup: false,
    isActivated: isActivatedSubscriptionStatus(status),
    cancellationRequested,
    restrictsWorkspace: false,
  };
}

export function canCustomerChangePlan(
  status: OrganizationSubscriptionStatus | null | undefined,
) {
  return status !== "cancelled";
}

export function customerPlanChangeAppliesImmediately(
  status: OrganizationSubscriptionStatus | null | undefined,
) {
  return isPendingSetupStatus(status);
}
