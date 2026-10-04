import "server-only";

import { getCommercialPlan } from "@/config/pricing";
import { ORGANIZATION_ADMIN_ROLES } from "@/lib/authorization/roles";
import { assertSelectableCommercialPlan, calculatePlanPrice } from "@/lib/billing/plans";
import { projectBillingStatus } from "@/lib/billing/status";
import type { BillingSnapshot } from "@/lib/billing/types";
import { createSupabaseServerClient } from "@/lib/database/server";
import { AppError, AuthorizationError, NotFoundError, ValidationError } from "@/lib/errors";
import { requireOrganizationRole } from "@/lib/tenancy/context";
import { requireWorkspaceView } from "@/lib/tenancy/workspace-access";
import type {
  OrganizationSubscription,
  OrganizationSubscriptionEvent,
} from "@/types/database";
import { PROPERTY_STATUSES } from "@/types/enums";
import type { WorkspaceView } from "@/types/auth";

const SUBSCRIPTION_COLUMNS =
  "id, organization_id, plan, status, billing_interval, started_at, renews_at, cancelled_at, requested_plan, cancellation_requested_at, created_at, updated_at";

const HISTORY_COLUMNS =
  "id, organization_id, subscription_id, event_type, previous_status, new_status, previous_plan, new_plan, source, actor_user_id, provider_event_id, metadata, created_at";

function failLoad(): never {
  throw new AppError("billing_unavailable", "Unable to load billing for this organization.", 500);
}

async function countActiveProperties(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", PROPERTY_STATUSES.ACTIVE);

  if (error) {
    failLoad();
  }

  return count ?? 0;
}

export async function getOrganizationSubscription(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organization_subscriptions")
    .select(SUBSCRIPTION_COLUMNS)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    failLoad();
  }

  return (data as OrganizationSubscription | null) ?? null;
}

export async function getSubscriptionHistory(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organization_subscription_events")
    .select(HISTORY_COLUMNS)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    failLoad();
  }

  return (data as OrganizationSubscriptionEvent[] | null) ?? [];
}

export async function getWorkspaceBillingSnapshot(
  view?: WorkspaceView,
): Promise<BillingSnapshot> {
  const workspace = view ?? (await requireWorkspaceView());
  const organizationId = workspace.context.organization.id;
  const [subscription, history, activePropertyCount] = await Promise.all([
    getOrganizationSubscription(organizationId),
    getSubscriptionHistory(organizationId),
    countActiveProperties(organizationId),
  ]);

  if (subscription && subscription.organization_id !== organizationId) {
    throw new AuthorizationError("Organization access denied.");
  }

  let price = null;

  if (subscription && getCommercialPlan(subscription.plan)?.status === "published") {
    price = calculatePlanPrice({
      planId: subscription.plan,
      activePropertyCount,
    });
  }

  return {
    organizationId,
    organizationName: workspace.context.organization.name,
    subscription,
    history,
    activePropertyCount,
    price,
    status: projectBillingStatus({
      status: subscription?.status ?? null,
      cancellationRequestedAt: subscription?.cancellation_requested_at,
    }),
    interval: subscription?.billing_interval ?? null,
    requestedPlan: subscription?.requested_plan ?? null,
    paymentProviderConfigured: false,
  };
}

async function requireBillingManager() {
  return requireOrganizationRole(ORGANIZATION_ADMIN_ROLES);
}

function publicBillingMutationError(error: unknown) {
  if (error instanceof ValidationError || error instanceof AppError) {
    return error.message;
  }

  const message = error instanceof Error ? error.message : "";

  if (/not authorized/i.test(message)) {
    return "Owners and admins can manage billing for this organization.";
  }

  if (/invalid subscription plan/i.test(message)) {
    return "Choose a published Onwarda plan.";
  }

  if (/already cancelled/i.test(message) || /cannot be reactivated/i.test(message)) {
    return "That billing change is not available for the current subscription.";
  }

  return "Unable to update billing.";
}

export async function selectPlan(planId: string) {
  assertSelectableCommercialPlan(planId);
  const context = await requireBillingManager();
  const current = await getOrganizationSubscription(context.organization.id);

  if (current && current.status !== "pending") {
    throw new ValidationError(
      "An activated subscription cannot change plan directly. Request a plan change instead.",
    );
  }

  return requestPlanChange(planId);
}

export async function requestPlanChange(planId: string) {
  assertSelectableCommercialPlan(planId);
  await requireBillingManager();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("customer_request_subscription_plan_change", {
    p_plan: planId,
  });

  if (error) {
    throw new AppError("billing_mutation_failed", publicBillingMutationError(error), 400);
  }
}

export async function requestCancellation() {
  await requireBillingManager();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("customer_request_subscription_cancellation");

  if (error) {
    throw new AppError("billing_mutation_failed", publicBillingMutationError(error), 400);
  }
}

export async function reactivateSubscription() {
  await requireBillingManager();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("customer_reactivate_subscription");

  if (error) {
    throw new AppError("billing_mutation_failed", publicBillingMutationError(error), 400);
  }
}

export function describeRequestedPlan(planId: string | null) {
  if (!planId) {
    return null;
  }

  return getCommercialPlan(planId)?.name ?? planId;
}

export function requireExistingSubscription(
  subscription: OrganizationSubscription | null,
): OrganizationSubscription {
  if (!subscription) {
    throw new NotFoundError("This organization does not have a subscription record yet.");
  }

  return subscription;
}
