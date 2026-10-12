"use client";

import { useActionState } from "react";

import { useI18n } from "@/i18n/provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createWorkspacePropertyAction,
  type WorkspaceMutationState,
} from "@/lib/workspace/actions";
import { PROPERTY_TYPES } from "@/types/enums";

const initialState: WorkspaceMutationState = {};
const selectClass = "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm";

export function CreatePropertyForm() {
  const { messages } = useI18n();
  const [state, formAction, pending] = useActionState(
    createWorkspacePropertyAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name">{messages.fields.propertyName}</Label>
        <Input id="name" name="name" required maxLength={120} placeholder="Riad Atlas" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="internalIdentifier">{messages.fields.internalId}</Label>
          <Input
            id="internalIdentifier"
            name="internalIdentifier"
            maxLength={80}
            placeholder="ATLAS-01"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="propertyType">{messages.fields.propertyType}</Label>
          <select id="propertyType" name="propertyType" defaultValue="" className={selectClass}>
            <option value="">{messages.screens.setLater}</option>
            {Object.values(PROPERTY_TYPES).map((type) => (
              <option key={type} value={type}>
                {messages.catalog[type]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">{messages.fields.city}</Label>
          <Input id="city" name="city" maxLength={80} placeholder="Marrakech" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="country">{messages.fields.country}</Label>
          <Input id="country" name="country" maxLength={80} placeholder="Morocco" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="status">{messages.fields.status}</Label>
        <select id="status" name="status" defaultValue="draft" className={selectClass}>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      <p className="text-sm text-onwarda-muted">
        Amenities, house rules, access notes, and media can be completed after the property exists.
      </p>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating..." : "Create property"}
      </Button>
    </form>
  );
}
