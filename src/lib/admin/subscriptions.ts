"use server";

import { redirect } from "next/navigation";

import { adminClientPath } from "@/config/admin";
import { requirePlatformAdmin } from "@/lib/authorization/platform-admin";
import { createServiceRoleClient } from "@/lib/database/admin";
import { createSupabaseServerClient } from "@/lib/database/server";
import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  toPublicErrorMessage,
} from "@/lib/errors";
import { setOrganizationSubscriptionSchema } from "@/lib/validation/organization";
import type { AdminMutationState } from "@/lib/admin/provision";
import type { OrganizationSubscription } from "@/types/database";

function publicSubscriptionError(error: unknown) {
  if (error instanceof ValidationError || error instanceof AppError) {
    return error.message;
  }

  const message = error instanceof Error ? error.message : "";

  if (/not authorized/i.test(message)) {
    return "Platform administrator access is required.";
  }

  if (/organization not found/i.test(message)) {
    return "That organization does not exist.";
  }

  if (/invalid subscription/i.test(message) || /cancellation cannot/i.test(message)) {
    return "Check the plan, status, interval, and dates.";
  }

  return toPublicErrorMessage(error);
}

function optionalTimestamp(value?: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError("Enter valid subscription dates.");
  }

  return parsed.toISOString();
}

export async function getOrganizationSubscription(organizationId: string) {
  await requirePlatformAdmin();
  const privileged = createServiceRoleClient();
  const { data, error } = await privileged
    .from("organization_subscriptions")
    .select(
      "id, organization_id, plan, status, billing_interval, started_at, renews_at, cancelled_at, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    throw new AppError(
      "subscription_unavailable",
      "Unable to load the organization subscription.",
      500,
    );
  }

  return (data as OrganizationSubscription | null) ?? null;
}

export async function setOrganizationSubscriptionAction(
  _previous: AdminMutationState,
  formData: FormData,
): Promise<AdminMutationState> {
  const organizationId = String(formData.get("organizationId") ?? "");

  try {
    await requirePlatformAdmin();
    const parsed = setOrganizationSubscriptionSchema.safeParse({
      organizationId,
      plan: formData.get("plan"),
      status: formData.get("status"),
      billingInterval: formData.get("billingInterval"),
      startedAt: String(formData.get("startedAt") ?? ""),
      renewsAt: String(formData.get("renewsAt") ?? ""),
      cancelledAt: String(formData.get("cancelledAt") ?? ""),
    });

    if (!parsed.success) {
      return { error: "Check the plan, status, interval, and dates." };
    }

    const scoped = await createSupabaseServerClient();
    const { error } = await scoped.rpc("admin_set_organization_subscription", {
      p_organization_id: parsed.data.organizationId,
      p_plan: parsed.data.plan,
      p_status: parsed.data.status,
      p_billing_interval: parsed.data.billingInterval,
      p_started_at: optionalTimestamp(parsed.data.startedAt) ?? new Date().toISOString(),
      p_renews_at: optionalTimestamp(parsed.data.renewsAt),
      p_cancelled_at: optionalTimestamp(parsed.data.cancelledAt),
    });

    if (error) {
      return { error: publicSubscriptionError(error) };
    }
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    if (error instanceof AuthorizationError) {
      return { error: "Platform administrator access is required." };
    }

    return { error: publicSubscriptionError(error) };
  }

  redirect(`${adminClientPath(organizationId)}?notice=subscription-updated`);
}
