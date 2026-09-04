"use client";

import { useActionState } from "react";

import {
  updateWorkspaceIssueStatusAction,
  type WorkspaceMutationState,
} from "@/lib/workspace/actions";
import { ISSUE_STATUSES } from "@/types/enums";

const initialState: WorkspaceMutationState = {};

export function IssueStatusForm({
  issueId,
  status,
}: {
  issueId: string;
  status: string;
}) {
  const [state, formAction, pending] = useActionState(
    updateWorkspaceIssueStatusAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <input type="hidden" name="issueId" value={issueId} />
      <select
        name="status"
        defaultValue={status}
        disabled={pending}
        aria-label="Issue status"
        className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        {Object.values(ISSUE_STATUSES).map((value) => (
          <option key={value} value={value}>
            {value.replaceAll("_", " ")}
          </option>
        ))}
      </select>
      {state.error ? (
        <p className="text-xs text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
