"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  setOrganizationStatusAction,
  type AdminMutationState,
} from "@/lib/admin/provision";

const initialState: AdminMutationState = {};

type OrganizationStatusFormProps = {
  organizationId: string;
  status: string;
};

export function OrganizationStatusForm({
  organizationId,
  status,
}: OrganizationStatusFormProps) {
  const [state, formAction, pending] = useActionState(
    setOrganizationStatusAction,
    initialState,
  );

  if (status === "archived") {
    return (
      <p className="text-sm text-muted-foreground">
        Archived organizations cannot be activated or suspended from this screen.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {status === "suspended" ? (
        <form action={formAction}>
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="status" value="active" />
          <Button type="submit" disabled={pending}>
            {pending ? "Updating..." : "Activate client"}
          </Button>
        </form>
      ) : (
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="status" value="suspended" />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="confirm" value="suspend" required className="mt-1" />
            <span>
              Suspend this client. Workspace access will be blocked. Organization data is not
              deleted.
            </span>
          </label>
          <Button type="submit" variant="destructive" disabled={pending}>
            {pending ? "Updating..." : "Suspend client"}
          </Button>
        </form>
      )}
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
