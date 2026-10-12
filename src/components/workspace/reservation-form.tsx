"use client";

import { useI18n } from "@/i18n/provider";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createWorkspaceReservationAction,
  type WorkspaceMutationState,
} from "@/lib/workspace/actions";
import { guestDisplayName } from "@/lib/workspace/format";

const initialState: WorkspaceMutationState = {};

type PropertyOption = {
  id: string;
  name: string;
  status: string;
};

type GuestOption = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
};

export function CreateReservationForm({
  properties,
  guests,
  defaultPropertyId,
}: {
  properties: PropertyOption[];
  guests: GuestOption[];
  defaultPropertyId?: string;
}) {
  const { messages } = useI18n();
  const [state, formAction, pending] = useActionState(
    createWorkspaceReservationAction,
    initialState,
  );
  const [guestMode, setGuestMode] = useState<"existing" | "new">(
    guests.length > 0 ? "existing" : "new",
  );

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="propertyId">{messages.fields.propertyName}</Label>
        <select
          id="propertyId"
          name="propertyId"
          required
          defaultValue={defaultPropertyId ?? ""}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
        >
          <option value="" disabled>
            Choose a property
          </option>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">{messages.fields.guest}</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="guestMode"
              value="existing"
              checked={guestMode === "existing"}
              onChange={() => setGuestMode("existing")}
              disabled={guests.length === 0}
            />
            Existing guest
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="guestMode"
              value="new"
              checked={guestMode === "new"}
              onChange={() => setGuestMode("new")}
            />
            New guest
          </label>
        </div>
        {guestMode === "existing" ? (
          <div className="space-y-2">
            <Label htmlFor="guestId">{messages.fields.guestInOrg}</Label>
            <select
              id="guestId"
              name="guestId"
              required={guestMode === "existing"}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="">Choose a guest</option>
              {guests.map((guest) => (
                <option key={guest.id} value={guest.id}>
                  {guestDisplayName({
                    first_name: guest.firstName,
                    last_name: guest.lastName,
                  })}
                  {guest.email ? ` · ${guest.email}` : ""}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">{messages.fields.firstName}</Label>
              <Input id="firstName" name="firstName" required maxLength={80} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">{messages.fields.lastName}</Label>
              <Input id="lastName" name="lastName" required maxLength={80} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{messages.auth.email}</Label>
              <Input id="email" name="email" type="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{messages.fields.phone}</Label>
              <Input id="phone" name="phone" maxLength={40} />
            </div>
          </div>
        )}
        <p className="text-xs text-onwarda-muted">
          Guests belong to this organization only. The same email may exist in
          another client and will never be attached from there.
        </p>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="checkIn">{messages.fields.arrival}</Label>
          <Input id="checkIn" name="checkIn" type="date" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="checkOut">{messages.fields.departure}</Label>
          <Input id="checkOut" name="checkOut" type="date" required />
        </div>
      </div>

      <input type="hidden" name="status" value="upcoming" />

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending || properties.length === 0}>
        {pending ? "Creating..." : "Create reservation"}
      </Button>
    </form>
  );
}
