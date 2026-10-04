"use server";

import { redirect } from "next/navigation";

import { CLIENT_ROUTES } from "@/config/client";
import {
  reactivateSubscription,
  requestCancellation,
  requestPlanChange,
  selectPlan,
} from "@/lib/billing/service";
import {
  AuthenticationError,
  AuthorizationError,
  TenantIsolationError,
  ValidationError,
  toPublicErrorMessage,
} from "@/lib/errors";
import { customerPlanChangeSchema } from "@/lib/validation/billing";

export type BillingMutationState = {
  error?: string;
};

function publicBillingError(error: unknown) {
  if (
    error instanceof ValidationError ||
    error instanceof AuthorizationError ||
    error instanceof TenantIsolationError
  ) {
    return error.message;
  }

  return toPublicErrorMessage(error);
}

export async function selectBillingPlanAction(
  _previous: BillingMutationState,
  formData: FormData,
): Promise<BillingMutationState> {
  const parsed = customerPlanChangeSchema.safeParse({
    plan: formData.get("plan"),
  });

  if (!parsed.success) {
    return { error: "Choose a published Onwarda plan." };
  }

  try {
    await selectPlan(parsed.data.plan);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    return { error: publicBillingError(error) };
  }

  redirect(`${CLIENT_ROUTES.billing}?notice=plan-updated`);
}

export async function requestBillingPlanChangeAction(
  _previous: BillingMutationState,
  formData: FormData,
): Promise<BillingMutationState> {
  const parsed = customerPlanChangeSchema.safeParse({
    plan: formData.get("plan"),
  });

  if (!parsed.success) {
    return { error: "Choose a published Onwarda plan." };
  }

  try {
    await requestPlanChange(parsed.data.plan);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    return { error: publicBillingError(error) };
  }

  redirect(`${CLIENT_ROUTES.billing}?notice=plan-change-requested`);
}

export async function requestBillingCancellationAction(
  _previous: BillingMutationState,
  formData: FormData,
): Promise<BillingMutationState> {
  void formData;
  try {
    await requestCancellation();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    return { error: publicBillingError(error) };
  }

  redirect(`${CLIENT_ROUTES.billing}?notice=cancellation-requested`);
}

export async function reactivateBillingSubscriptionAction(
  _previous: BillingMutationState,
  formData: FormData,
): Promise<BillingMutationState> {
  void formData;
  try {
    await reactivateSubscription();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    return { error: publicBillingError(error) };
  }

  redirect(`${CLIENT_ROUTES.billing}?notice=cancellation-withdrawn`);
}
