"use client";

import { useActionState, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createWorkspacePropertyAction,
  updateWorkspacePropertyAction,
  type WorkspaceMutationState,
} from "@/lib/workspace/actions";

const initialState: WorkspaceMutationState = {};

export function CreatePropertyForm() {
  const [state, formAction, pending] = useActionState(
    createWorkspacePropertyAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name">Property name</Label>
        <Input id="name" name="name" required maxLength={120} placeholder="Riad Atlas" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" maxLength={80} placeholder="Marrakech" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Input id="country" name="country" maxLength={80} placeholder="Morocco" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <select
          id="status"
          name="status"
          defaultValue="active"
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
        >
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
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

export function EditPropertyForm({
  propertyId,
  name,
  city,
  country,
  status,
}: {
  propertyId: string;
  name: string;
  city: string | null;
  country: string | null;
  status: string;
}) {
  const action = useMemo(
    () => updateWorkspacePropertyAction.bind(null, propertyId),
    [propertyId],
  );
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="edit-name">Property name</Label>
        <Input
          id="edit-name"
          name="name"
          required
          maxLength={120}
          defaultValue={name}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="edit-city">City</Label>
          <Input id="edit-city" name="city" maxLength={80} defaultValue={city ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-country">Country</Label>
          <Input
            id="edit-country"
            name="country"
            maxLength={80}
            defaultValue={country ?? ""}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-status">Status</Label>
        <select
          id="edit-status"
          name="status"
          defaultValue={status === "archived" ? "inactive" : status}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
        >
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save property"}
      </Button>
    </form>
  );
}
