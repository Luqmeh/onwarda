"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  acceptGuestRulesAction,
  completeGuestCheckoutAction,
  createGuestIssueAction,
  updateGuestArrivalAction,
  updateGuestOnboardingAction,
  type GuestMutationState,
} from "@/lib/guest-portal/actions";
import { ISSUE_CATEGORIES } from "@/types/enums";

const initialState: GuestMutationState = {};

const ISSUE_LABELS: Record<string, string> = {
  access_problem: "Access problem",
  wifi: "Wi-Fi",
  hot_water: "Hot water",
  air_conditioning: "Air conditioning",
  cleaning: "Missing item or cleaning",
  something_broken: "Something broken",
  other: "Other",
};

export function GuestOnboardingForm({
  token,
  firstName,
  lastName,
  email,
  phone,
  numberOfGuests,
  completed,
}: {
  token: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  numberOfGuests: number;
  completed: boolean;
}) {
  const action = updateGuestOnboardingAction.bind(null, token);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="firstName">First name</Label>
          <Input id="firstName" name="firstName" required maxLength={80} defaultValue={firstName} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last name</Label>
          <Input id="lastName" name="lastName" required maxLength={80} defaultValue={lastName} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" defaultValue={email ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone / WhatsApp</Label>
        <Input id="phone" name="phone" defaultValue={phone ?? ""} maxLength={40} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="numberOfGuests">Number of guests</Label>
        <Input
          id="numberOfGuests"
          name="numberOfGuests"
          type="number"
          min={1}
          max={50}
          required
          defaultValue={numberOfGuests}
        />
      </div>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button
        type="submit"
        className="min-h-12 w-full"
        disabled={pending}
        aria-label={completed ? "Save guest information and continue" : "Save guest information and continue"}
      >
        {pending ? "Saving..." : "Save & continue →"}
      </Button>
    </form>
  );
}

export function GuestArrivalForm({
  token,
  arrivalNotes,
  completed,
}: {
  token: string;
  arrivalNotes: string | null;
  completed: boolean;
}) {
  const action = updateGuestArrivalAction.bind(null, token);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="arrivalNotes">How will you arrive?</Label>
        <textarea
          id="arrivalNotes"
          name="arrivalNotes"
          required
          rows={4}
          maxLength={2000}
          defaultValue={arrivalNotes ?? ""}
          placeholder="Flight, train, taxi, or the time you expect to reach the property."
          className="min-h-24 w-full rounded-lg border bg-background px-3 py-2 text-sm"
        />
      </div>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button
        type="submit"
        className="min-h-12 w-full"
        disabled={pending}
        aria-label={completed ? "Save arrival information and continue" : "Save arrival information and continue"}
      >
        {pending ? "Saving..." : "Save & continue →"}
      </Button>
    </form>
  );
}

export function GuestRulesForm({ token }: { token: string }) {
  const action = acceptGuestRulesAction.bind(null, token);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm text-onwarda-muted">
        Please review the house rules before continuing. Acceptance is recorded on this stay after you confirm.
      </p>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" className="min-h-12 w-full" disabled={pending}>
        {pending ? "Saving..." : "Accept house rules & continue"}
      </Button>
    </form>
  );
}

export function GuestIssueForm({ token }: { token: string }) {
  const action = createGuestIssueAction.bind(null, token);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="category">What needs attention?</Label>
        <select
          id="category"
          name="category"
          required
          className="min-h-11 w-full rounded-lg border bg-background px-3 text-sm"
          defaultValue="other"
        >
          {Object.values(ISSUE_CATEGORIES).map((category) => (
            <option key={category} value={category}>
              {ISSUE_LABELS[category] ?? category}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Describe the issue</Label>
        <textarea
          id="description"
          name="description"
          required
          minLength={3}
          maxLength={2000}
          rows={4}
          className="min-h-24 w-full rounded-lg border bg-background px-3 py-2 text-sm"
        />
      </div>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-[var(--client-primary)]" role="status">
          {state.success}
        </p>
      ) : null}
      <Button type="submit" className="min-h-11 w-full" disabled={pending}>
        {pending ? "Sending..." : "Send to host"}
      </Button>
    </form>
  );
}

export function GuestCheckoutForm({
  token,
  completed,
}: {
  token: string;
  completed: boolean;
}) {
  const action = completeGuestCheckoutAction.bind(null, token);
  const [state, formAction, pending] = useActionState(action, initialState);

  if (completed) {
    return <p className="text-sm text-onwarda-muted">Checkout is complete. Thank you for staying with us.</p>;
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" className="min-h-12 w-full" disabled={pending}>
        {pending ? "Saving..." : "Complete checkout →"}
      </Button>
    </form>
  );
}
