"use client";

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
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="guest-first-name">First name</Label>
          <Input
            id="guest-first-name"
            name="firstName"
            required
            maxLength={80}
            defaultValue={firstName}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="guest-last-name">Last name</Label>
          <Input
            id="guest-last-name"
            name="lastName"
            required
            maxLength={80}
            defaultValue={lastName}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="guest-email">Email</Label>
          <Input
            id="guest-email"
            name="email"
            type="email"
            defaultValue={email ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="guest-phone">Phone</Label>
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
        {pending ? "Saving..." : "Save guest"}
      </Button>
    </form>
  );
}
