"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listPublishedCommercialPlans } from "@/config/pricing";
import {
  commercialOnboardingAction,
  commercialSignupAction,
  type CommercialActionState,
} from "@/lib/commercial/actions";

const initialState: CommercialActionState = {};

export function CommercialSignupForm({
  selectedPlan,
  existingAccount,
}: {
  selectedPlan: string;
  existingAccount: boolean;
}) {
  const action = existingAccount ? commercialOnboardingAction : commercialSignupAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const plans = listPublishedCommercialPlans();

  return (
    <form action={formAction} className="space-y-4">
      {!existingAccount ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" name="fullName" required maxLength={120} autoComplete="name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
            />
          </div>
        </>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="organizationName">Organization / operator name</Label>
        <Input id="organizationName" name="organizationName" required maxLength={120} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone (optional)</Label>
        <Input id="phone" name="phone" maxLength={40} autoComplete="tel" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="plan">Selected plan</Label>
        <select
          id="plan"
          name="plan"
          required
          defaultValue={selectedPlan}
          className="min-h-11 w-full rounded-lg border bg-background px-3 text-sm"
        >
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name}
            </option>
          ))}
        </select>
      </div>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <p className="text-sm text-[var(--mk-muted)]">
        Creating an account does not activate a paid subscription. Payment setup is coming next.
      </p>
      <Button type="submit" className="min-h-12 w-full" disabled={pending}>
        {pending ? "Saving..." : existingAccount ? "Continue with this plan" : "Create account"}
      </Button>
    </form>
  );
}
