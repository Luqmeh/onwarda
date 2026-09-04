"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  endSupportSessionAction,
  startSupportSessionAction,
} from "@/lib/admin/support";
import type { AdminMutationState } from "@/lib/admin/provision";

const initialState: AdminMutationState = {};

type EnterSupportFormProps = {
  organizationId: string;
  organizationName: string;
};

export function EnterSupportForm({
  organizationId,
  organizationName,
}: EnterSupportFormProps) {
  const [state, formAction, pending] = useActionState(
    startSupportSessionAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="organizationId" value={organizationId} />
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Reason</span>
        <textarea
          name="reason"
          required
          minLength={3}
          maxLength={500}
          rows={3}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm"
          placeholder="Why are you entering this client?"
        />
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="confirm" value="support" required className="mt-1" />
        <span>
          Start a time-limited support session for {organizationName}. This does not make
          you a client user and does not change organization membership.
        </span>
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "Starting..." : "Enter support mode"}
      </Button>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

export function ExitSupportForm({
  organizationId,
  sessionId,
}: {
  organizationId?: string;
  sessionId: string;
}) {
  const [state, formAction, pending] = useActionState(
    endSupportSessionAction,
    initialState,
  );

  return (
    <form action={formAction}>
      {organizationId ? (
        <input type="hidden" name="organizationId" value={organizationId} />
      ) : null}
      <input type="hidden" name="sessionId" value={sessionId} />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Exiting..." : "Exit support mode"}
      </Button>
      {state.error ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
