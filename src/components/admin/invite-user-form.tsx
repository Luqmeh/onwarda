"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  inviteOrganizationUserAction,
} from "@/lib/admin/members";
import type { AdminMutationState } from "@/lib/admin/provision";

const initialState: AdminMutationState = {};

export function InviteUserForm({ organizationId }: { organizationId: string }) {
  const [state, formAction, pending] = useActionState(
    inviteOrganizationUserAction,
    initialState,
  );

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-[1fr_10rem_auto]">
      <input type="hidden" name="organizationId" value={organizationId} />
      <div className="space-y-1">
        <Label htmlFor="invite-email" className="sr-only">
          Email
        </Label>
        <Input
          id="invite-email"
          name="email"
          type="email"
          required
          placeholder="user@example.com"
          autoComplete="off"
        />
      </div>
      <div>
        <Label htmlFor="invite-role" className="sr-only">
          Role
        </Label>
        <select
          id="invite-role"
          name="role"
          defaultValue="staff"
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
        >
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="staff">Staff</option>
        </select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Inviting..." : "Invite user"}
      </Button>
      {state.error ? (
        <p className="text-sm text-destructive sm:col-span-3" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
