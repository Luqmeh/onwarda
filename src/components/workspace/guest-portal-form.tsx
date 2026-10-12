"use client";

import { useActionState } from "react";

import { CopyLinkButton } from "@/components/admin/copy-link-button";
import { useI18n } from "@/i18n/provider";
import { formattingLocale } from "@/i18n/locale";
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
  const { locale, messages } = useI18n();
  const createAction = createWorkspaceGuestPortalLinkAction.bind(null, reservationId);
  const revokeAction = revokeWorkspaceGuestPortalLinkAction.bind(null, reservationId);
  const [createState, createFormAction, creating] = useActionState(createAction, createInitial);
  const [revokeState, revokeFormAction, revoking] = useActionState(revokeAction, revokeInitial);

  return (
    <div className="space-y-4">
      <p className="text-sm text-onwarda-muted">
        {hasActiveLink
          ? expiresAt
            ? `${messages.actions.guestLinkActive} ${new Date(expiresAt).toLocaleDateString(formattingLocale(locale), { calendar: "gregory" })}`
            : messages.actions.guestLinkActive
          : messages.actions.guestLinkNone}
      </p>
      <form action={createFormAction}>
        {createState.error ? (
          <p className="mb-2 text-sm text-destructive" role="alert">
            {createState.error}
          </p>
        ) : null}
        <Button type="submit" disabled={creating}>
          {creating ? messages.actions.generating : hasActiveLink ? messages.actions.replaceGuestLink : messages.actions.generateGuestLink}
        </Button>
      </form>
      {createState.portalUrl ? (
        <div className="space-y-2 rounded-lg bg-onwarda-cream/80 p-3">
          <p className="break-all text-sm" dir="ltr">{createState.portalUrl}</p>
          <CopyLinkButton value={createState.portalUrl} label={messages.actions.copyGuestLink} />
          <p className="text-xs text-onwarda-muted">
            {messages.actions.guestLinkOnce}
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
            {revoking ? messages.actions.revoking : messages.actions.revokeGuestLink}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
