"use client";

import { useState } from "react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { permanentlyDeleteOrganizationAction } from "@/lib/admin/offboarding-actions";
import type {
  DeletionActionState,
  DeletionCounts,
  OrganizationDeletionPreview,
} from "@/lib/admin/offboarding-types";

const initialState: DeletionActionState = {};

const COUNT_LABELS: Array<[keyof DeletionCounts, string]> = [
  ["organizations", "Organization"],
  ["onboarding", "Onboarding"],
  ["branding", "Branding"],
  ["members", "Members and invitations"],
  ["properties", "Properties"],
  ["reservations", "Reservations"],
  ["guests", "Guests"],
  ["guestPortalTokens", "Guest portal tokens"],
  ["guestRuleAcceptances", "Guest rule acceptances"],
  ["propertyLanguages", "Property languages"],
  ["propertyAmenities", "Property amenity assignments"],
  ["propertyHouseRules", "Property house-rule assignments"],
  ["propertyContent", "Property content"],
  ["propertyKnowledge", "Property knowledge"],
  ["propertyMedia", "Property media records"],
  ["issues", "Issues"],
  ["events", "Operational events"],
  ["cleaningAgents", "Cleaning agents"],
  ["cleaningAgentLinks", "Cleaner access links"],
  ["propertyCleaningAgents", "Default cleaner assignments"],
  ["cleaningTasks", "Cleaning tasks"],
  ["cleaningTaskItems", "Cleaning checklist items"],
  ["subscriptions", "Subscription records"],
  ["subscriptionEvents", "Subscription events"],
  ["supportSessions", "Support sessions"],
  ["auditLogs", "Tenant audit records"],
  ["storageObjects", "Stored files"],
];

const SHARED_LABELS: Record<string, string> = {
  amenity_definitions: "Global amenity definitions",
  house_rule_definitions: "Global house-rule definitions",
  cleaning_checklist_definitions: "Global cleaning checklist definitions",
  commercial_inquiries: "Platform commercial inquiries",
};

type PermanentDeletionProps = {
  organizationId: string;
  organizationName: string;
  slug: string;
  preview: OrganizationDeletionPreview;
};

export function PermanentDeletionWorkflow({
  organizationId,
  organizationName,
  slug,
  preview,
}: PermanentDeletionProps) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<"review" | "accounts" | "confirm">("review");
  const [confirmation, setConfirmation] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [state, formAction, pending] = useActionState(
    permanentlyDeleteOrganizationAction,
    initialState,
  );
  const ready = confirmation.trim() === slug && acknowledged && !pending;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Suspension keeps this client&apos;s data and can be reversed. Permanent deletion
        removes the organization and its tenant data. It cannot be undone from this screen.
      </p>
      {!open ? (
        <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
          Permanently delete client
        </Button>
      ) : (
        <div className="space-y-4 rounded-lg border border-destructive/40 p-4">
          <p className="text-sm font-medium">
            {organizationName} · slug <span className="font-mono">{slug}</span>
          </p>
          {stage === "review" ? (
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Records that will be removed</h3>
              <ul className="grid gap-1 text-sm sm:grid-cols-2">
                {COUNT_LABELS.map(([key, label]) => (
                  <li key={key} className="flex justify-between gap-3 border-b py-1">
                    <span>{label}</span>
                    <span className="font-medium tabular-nums">{preview.counts[key]}</span>
                  </li>
                ))}
              </ul>
              <h3 className="text-sm font-medium">Left in place</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {preview.preservedShared.map((key) => (
                  <li key={key}>{SHARED_LABELS[key] ?? key}</li>
                ))}
              </ul>
              <Button type="button" onClick={() => setStage("accounts")}>
                Review accounts
              </Button>
            </div>
          ) : null}
          {stage === "accounts" ? (
            <div className="space-y-3 text-sm">
              <p>
                <span className="font-medium tabular-nums">{preview.auth.eligible}</span> Auth
                accounts are eligible for removal because they belong only to this organization
                and are not platform administrators.
              </p>
              <p>
                <span className="font-medium tabular-nums">{preview.auth.shared}</span> accounts
                also belong to another organization. Their membership here will be removed and
                the account will be kept.
              </p>
              <p>
                <span className="font-medium tabular-nums">{preview.auth.platformAdmins}</span>{" "}
                platform administrator accounts will be kept.
              </p>
              <p>
                <span className="font-medium tabular-nums">{preview.auth.review}</span> memberships
                could not be matched to an Auth account and will be kept for review.
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setStage("review")}>
                  Back
                </Button>
                <Button type="button" onClick={() => setStage("confirm")}>
                  Continue
                </Button>
              </div>
            </div>
          ) : null}
          {stage === "confirm" ? (
            <form action={formAction} className="space-y-3">
              <p className="text-sm font-medium text-destructive">
                This permanently deletes {organizationName} and its tenant data. This cannot be
                undone from Onwarda.
              </p>
              <input type="hidden" name="organizationId" value={organizationId} />
              <label className="block space-y-1 text-sm">
                <span>
                  Type <span className="font-mono">{slug}</span> to confirm.
                </span>
                <Input
                  name="confirmation"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoComplete="off"
                  required
                />
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  name="acknowledge"
                  value="delete"
                  checked={acknowledged}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                  className="mt-1"
                  required
                />
                <span>I understand this permanently deletes this client&apos;s tenant data.</span>
              </label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => setStage("accounts")}>
                  Back
                </Button>
                <Button type="submit" variant="destructive" disabled={!ready}>
                  {pending ? "Deleting client data..." : "Delete client and all associated data permanently"}
                </Button>
              </div>
            </form>
          ) : null}
          {state.error ? (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}
          {state.incomplete ? (
            <div className="space-y-2 text-sm" role="alert">
              <p className="font-medium">Deletion is incomplete.</p>
              <p>{state.incomplete.detail}</p>
              <ul>
                <li>Storage removed: {state.incomplete.storageRemoved ? "yes" : "no"}</li>
                <li>Database removed: {state.incomplete.databaseRemoved ? "yes" : "no"}</li>
                <li>Exclusive accounts removed: {state.incomplete.authRemoved ? "yes" : "no"}</li>
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
