"use client";

import { useActionState } from "react";

import { CopyLinkButton } from "@/components/admin/copy-link-button";
import { Button } from "@/components/ui/button";
import {
  createWorkspaceGuestPortalLinkAction,
  revokeWorkspaceGuestPortalLinkAction,
  type GuestPortalLinkState,
  type WorkspaceMutationState,
} from "@/lib/workspace/actions";

const createInitial: GuestPortalLinkState = {};
const revokeInitial: WorkspaceMutationState = {};

export function GuestPortalForm({
  reservationId,
  hasActiveLink,
  expiresAt,
}: {
  reservationId: string;
  hasActiveLink: boolean;
  expiresAt: string | null;
}) {
  const createAction = createWorkspaceGuestPortalLinkAction.bind(null, reservationId);
  const revokeAction = revokeWorkspaceGuestPortalLinkAction.bind(null, reservationId);
  const [createState, createFormAction, creating] = useActionState(createAction, createInitial);
  const [revokeState, revokeFormAction, revoking] = useActionState(revokeAction, revokeInitial);

  return (
    <div className="space-y-4">
      <p className="text-sm text-onwarda-muted">
        {hasActiveLink
          ? `A guest stay link is active${expiresAt ? ` until ${new Date(expiresAt).toLocaleDateString()}` : ""}. Generate a new one to replace it.`
          : "No guest stay link is active. Generate an opaque link for this reservation only."}
      </p>
      <form action={createFormAction}>
        {createState.error ? (
          <p className="mb-2 text-sm text-destructive" role="alert">
            {createState.error}
          </p>
        ) : null}
        <Button type="submit" disabled={creating}>
          {creating ? "Generating..." : hasActiveLink ? "Replace guest link" : "Generate guest link"}
        </Button>
      </form>
      {createState.portalUrl ? (
        <div className="space-y-2 rounded-lg bg-onwarda-cream/80 p-3">
          <p className="break-all text-sm">{createState.portalUrl}</p>
          <CopyLinkButton value={createState.portalUrl} label="Copy guest link" />
          <p className="text-xs text-onwarda-muted">
            This full link is shown once. Onwarda stores only the hashed token.
          </p>
        </div>
      ) : null}
      {hasActiveLink ? (
        <form action={revokeFormAction}>
          {revokeState.error ? (
            <p className="mb-2 text-sm text-destructive" role="alert">
              {revokeState.error}
            </p>
          ) : null}
          <Button type="submit" variant="outline" disabled={revoking}>
            {revoking ? "Revoking..." : "Revoke guest link"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
