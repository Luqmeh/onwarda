"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  setOrganizationUserRoleAction,
  setOrganizationUserStatusAction,
} from "@/lib/admin/members";
import type { AdminMutationState } from "@/lib/admin/provision";

const initialState: AdminMutationState = {};

type MemberActionsProps = {
  organizationId: string;
  userId: string;
  role: string;
  status: string;
  isLastOwner: boolean;
};

export function MemberActions({
  organizationId,
  userId,
  role,
  status,
  isLastOwner,
}: MemberActionsProps) {
  const [roleState, roleAction, rolePending] = useActionState(
    setOrganizationUserRoleAction,
    initialState,
  );
  const [statusState, statusAction, statusPending] = useActionState(
    setOrganizationUserStatusAction,
    initialState,
  );

  const canChangeRole = role !== "owner" || !isLastOwner;
  const canSuspend = !(role === "owner" && isLastOwner);

  return (
    <div className="flex flex-col items-end gap-2">
      {canChangeRole ? (
        <form action={roleAction} className="flex items-center gap-2">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="userId" value={userId} />
          <select
            name="role"
            defaultValue={role === "owner" ? "admin" : role}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            aria-label="Organization role"
          >
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="staff">Staff</option>
          </select>
          <Button type="submit" variant="outline" size="sm" disabled={rolePending}>
            {rolePending ? "Saving..." : "Change role"}
          </Button>
        </form>
      ) : (
        <p className="text-xs text-muted-foreground">Last owner role is locked.</p>
      )}

      {status === "suspended" ? (
        <form action={statusAction}>
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="status" value="active" />
          <Button type="submit" variant="outline" size="sm" disabled={statusPending}>
            {statusPending ? "Updating..." : "Reactivate"}
          </Button>
        </form>
      ) : canSuspend ? (
        <form action={statusAction}>
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="status" value="suspended" />
          <Button type="submit" variant="destructive" size="sm" disabled={statusPending}>
            {statusPending ? "Updating..." : "Suspend"}
          </Button>
        </form>
      ) : (
        <p className="text-xs text-muted-foreground">The last owner cannot be suspended.</p>
      )}

      {roleState.error || statusState.error ? (
        <p className="text-xs text-destructive" role="alert">
          {roleState.error || statusState.error}
        </p>
      ) : null}
    </div>
  );
}
