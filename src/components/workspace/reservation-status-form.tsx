"use client";

import { useI18n } from "@/i18n/provider";

import { useActionState, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  updateWorkspaceReservationStatusAction,
  type WorkspaceMutationState,
} from "@/lib/workspace/actions";
import { RESERVATION_STATUSES } from "@/types/enums";
import { reservationStatusLabel } from "@/lib/workspace/format";

const initialState: WorkspaceMutationState = {};

export function ReservationStatusForm({
  reservationId,
  status,
}: {
  reservationId: string;
  status: string;
}) {
  const { messages } = useI18n();
  const action = useMemo(
    () => updateWorkspaceReservationStatusAction.bind(null, reservationId),
    [reservationId],
  );
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="reservation-status">{messages.fields.stayStatus}</Label>
        <select
          id="reservation-status"
          name="status"
          defaultValue={status}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
        >
          {Object.values(RESERVATION_STATUSES).map((value) => (
            <option key={value} value={value}>
              {reservationStatusLabel(value)}
            </option>
          ))}
        </select>
      </div>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? messages.actions.saving : messages.actions.updateStatus}
      </Button>
    </form>
  );
}
