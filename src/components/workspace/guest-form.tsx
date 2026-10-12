"use client";

import { useI18n } from "@/i18n/provider";

import { useActionState, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateWorkspaceGuestAction,
  type WorkspaceMutationState,
} from "@/lib/workspace/actions";

const initialState: WorkspaceMutationState = {};

export function EditGuestForm({
  guestId,
  firstName,
  lastName,
  email,
  phone,
}: {
  guestId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
}) {
  const action = useMemo(
    () => updateWorkspaceGuestAction.bind(null, guestId),
    [guestId],
  );
  const { messages } = useI18n();
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="guest-first-name">{messages.fields.firstName}</Label>
          <Input
            id="guest-first-name"
            name="firstName"
            required
            maxLength={80}
            defaultValue={firstName}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="guest-last-name">{messages.fields.lastName}</Label>
          <Input
            id="guest-last-name"
            name="lastName"
            required
            maxLength={80}
            defaultValue={lastName}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="guest-email">{messages.auth.email}</Label>
          <Input
            id="guest-email"
            name="email"
            type="email"
            defaultValue={email ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="guest-phone">{messages.fields.phone}</Label>
          <Input
            id="guest-phone"
            name="phone"
            maxLength={40}
            defaultValue={phone ?? ""}
          />
        </div>
      </div>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? messages.actions.saving : messages.actions.saveGuest}
      </Button>
    </form>
  );
}
