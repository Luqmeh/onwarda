"use client";

import { useActionState } from "react";

import { useI18n } from "@/i18n/provider";
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
  const { messages } = useI18n();
  const action = appliesImmediately ? selectBillingPlanAction : requestBillingPlanChangeAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const plans = listPublishedCommercialPlans();

  return (
    <form action={formAction} className="space-y-3">
      <label className="block space-y-1 text-sm">
        <span className="font-medium">
          {appliesImmediately ? messages.actions.selectedPlan : messages.actions.requestDifferentPlan}
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
          ? messages.actions.planPendingHelp
          : messages.actions.planRequestHelp}
      </p>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending
          ? messages.actions.saving
          : appliesImmediately
            ? messages.actions.updateSelectedPlan
            : messages.actions.requestPlanChange}
      </Button>
    </form>
  );
}

export function CustomerCancellationForm({
  cancellationRequested,
}: {
  cancellationRequested: boolean;
}) {
  const { messages } = useI18n();
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
          {messages.actions.withdrawHelp}
        </p>
        {reactivateState.error ? (
          <p className="text-sm text-destructive" role="alert">
            {reactivateState.error}
          </p>
        ) : null}
        <Button type="submit" variant="outline" disabled={reactivating}>
          {reactivating ? messages.actions.updating : messages.actions.withdrawCancellation}
        </Button>
      </form>
    );
  }

  return (
    <form action={cancelAction} className="space-y-3">
      <p className="text-sm text-onwarda-muted">
        {messages.actions.cancellationHelp}
      </p>
      {cancelState.error ? (
        <p className="text-sm text-destructive" role="alert">
          {cancelState.error}
        </p>
      ) : null}
      <Button type="submit" variant="outline" disabled={cancelling}>
        {cancelling ? messages.actions.updating : messages.actions.requestCancellation}
      </Button>
    </form>
  );
}
