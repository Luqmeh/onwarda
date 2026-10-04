"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listPublishedCommercialPlans } from "@/config/pricing";
import { submitCommercialInquiryAction, type CommercialActionState } from "@/lib/commercial/actions";

const initialState: CommercialActionState = {};

export function CommercialContactForm({
  kind = "contact",
  selectedPlan,
}: {
  kind?: "contact" | "demo";
  selectedPlan?: string | null;
}) {
  const [state, formAction, pending] = useActionState(submitCommercialInquiryAction, initialState);
  const plans = listPublishedCommercialPlans();

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="kind" value={kind} />
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required maxLength={120} autoComplete="name" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="companyName">Company / operator name</Label>
        <Input id="companyName" name="companyName" maxLength={160} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="propertyCount">Number of properties</Label>
          <Input id="propertyCount" name="propertyCount" maxLength={40} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="plan">Plan of interest</Label>
          <select
            id="plan"
            name="plan"
            defaultValue={selectedPlan ?? ""}
            className="min-h-11 w-full rounded-lg border bg-background px-3 text-sm"
          >
            <option value="">Not sure yet</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="message">Message</Label>
        <textarea
          id="message"
          name="message"
          required
          minLength={3}
          maxLength={4000}
          rows={5}
          className="min-h-28 w-full rounded-lg border bg-background px-3 py-2 text-sm"
        />
      </div>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-[var(--mk-olive)]" role="status">
          {state.success}
        </p>
      ) : null}
      <Button type="submit" className="min-h-12 w-full" disabled={pending}>
        {pending ? "Sending..." : kind === "demo" ? "Request a conversation" : "Send message"}
      </Button>
    </form>
  );
}
