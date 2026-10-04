"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  reactivateBillingSubscriptionAction,
  requestBillingCancellationAction,
  requestBillingPlanChangeAction,
  selectBillingPlanAction,
  type BillingMutationState,
} from "@/lib/billing/actions";
import { listPublishedCommercialPlans } from "@/config/pricing";
import type { OrganizationPlan } from "@/types/enums";

const initialState: BillingMutationState = {};

export function CustomerPlanForm({
  currentPlan,
  appliesImmediately,
}: {
  currentPlan: OrganizationPlan | null;
  appliesImmediately: boolean;
}) {
  const action = appliesImmediately ? selectBillingPlanAction : requestBillingPlanChangeAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const plans = listPublishedCommercialPlans();

  return (
    <form action={formAction} className="space-y-3">
      <label className="block space-y-1 text-sm">
        <span className="font-medium">
          {appliesImmediately ? "Selected plan" : "Request a different plan"}
        </span>
        <select
          name="plan"
          defaultValue={currentPlan ?? "professional"}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
        >
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-onwarda-muted">
        {appliesImmediately
          ? "This updates the pending subscription only. It does not activate billing."
          : "The current plan stays in place. This stores a request until billing can apply it."}
      </p>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending
          ? "Saving..."
          : appliesImmediately
            ? "Update selected plan"
            : "Request plan change"}
      </Button>
    </form>
  );
}

export function CustomerCancellationForm({
  cancellationRequested,
}: {
  cancellationRequested: boolean;
}) {
  const [cancelState, cancelAction, cancelling] = useActionState(
    requestBillingCancellationAction,
    initialState,
  );
  const [reactivateState, reactivateAction, reactivating] = useActionState(
    reactivateBillingSubscriptionAction,
    initialState,
  );

  if (cancellationRequested) {
    return (
      <form action={reactivateAction} className="space-y-3">
        <p className="text-sm text-onwarda-muted">
          Cancellation is requested. The subscription record is still here and is not billed.
        </p>
        {reactivateState.error ? (
          <p className="text-sm text-destructive" role="alert">
            {reactivateState.error}
          </p>
        ) : null}
        <Button type="submit" variant="outline" disabled={reactivating}>
          {reactivating ? "Updating..." : "Withdraw cancellation request"}
        </Button>
      </form>
    );
  }

  return (
    <form action={cancelAction} className="space-y-3">
      <p className="text-sm text-onwarda-muted">
        Request cancellation without deleting the subscription. Completion stays with Onwarda
        until billing is connected.
      </p>
      {cancelState.error ? (
        <p className="text-sm text-destructive" role="alert">
          {cancelState.error}
        </p>
      ) : null}
      <Button type="submit" variant="outline" disabled={cancelling}>
        {cancelling ? "Updating..." : "Request cancellation"}
      </Button>
    </form>
  );
}
