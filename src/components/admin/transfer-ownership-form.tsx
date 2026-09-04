"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { transferOrganizationOwnershipAction } from "@/lib/admin/members";
import type { AdminMutationState } from "@/lib/admin/provision";
import type { AdminOrganizationMember } from "@/lib/admin/organizations";

const initialState: AdminMutationState = {};

type TransferOwnershipFormProps = {
  organizationId: string;
  candidates: AdminOrganizationMember[];
};

export function TransferOwnershipForm({
  organizationId,
  candidates,
}: TransferOwnershipFormProps) {
  const [state, formAction, pending] = useActionState(
    transferOrganizationOwnershipAction,
    initialState,
  );

  if (candidates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Ownership transfer needs another active member in this organization. Invite or
        reactivate a member first.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="organizationId" value={organizationId} />
      <select
        name="userId"
        required
        className="h-8 w-full max-w-md rounded-lg border border-input bg-transparent px-2.5 text-sm"
        aria-label="New owner"
      >
        {candidates.map((member) => (
          <option key={member.userId} value={member.userId}>
            {member.fullName || member.email || "Organization member"} · {member.role}
          </option>
        ))}
      </select>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="confirm" value="transfer" required className="mt-1" />
        <span>
          Transfer ownership atomically. The current owner becomes an organization admin.
        </span>
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "Transferring..." : "Transfer ownership"}
      </Button>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
