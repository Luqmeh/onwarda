export type CleaningTrigger = "guest_checkout" | "manual";

export type ManualCleaningDraft = {
  propertyId: string;
  reservationId: null;
  status: "queued";
  triggerType: "manual";
  assigneeId: string | null;
  requestKey: string;
  confirmExtra: boolean;
};

export type AssignmentChange = "unchanged" | "assigned" | "unassigned" | "reassigned";

export type PropertyTeamChange = "add" | "reactivate" | "duplicate" | "remove" | "absent";

export type ManualCleaningDecision =
  | { action: "replay"; taskId: string }
  | { action: "conflict"; taskId: string }
  | { action: "create" };

/** Earliest active property assignment wins. Matches default_cleaning_agent() ordering. */
export function selectDefaultCleaner(
  assignments: Array<{ assignmentId: string; agentId: string; createdAt: string; active: boolean }>,
) {
  return (
    assignments
      .filter((assignment) => assignment.active)
      .sort((left, right) => {
        if (left.createdAt !== right.createdAt) {
          return left.createdAt < right.createdAt ? -1 : 1;
        }

        return left.assignmentId < right.assignmentId ? -1 : 1;
      })[0]?.agentId ?? null
  );
}

export function manualCleaningDraft(input: {
  propertyId: string;
  assigneeId: string | null;
  requestKey: string;
  confirmExtra: boolean;
}): ManualCleaningDraft {
  return {
    propertyId: input.propertyId,
    reservationId: null,
    status: "queued",
    triggerType: "manual",
    assigneeId: input.assigneeId,
    requestKey: input.requestKey,
    confirmExtra: input.confirmExtra,
  };
}

/**
 * Same request key replays the original task.
 * An open task blocks a second create until the operator confirms.
 */
export function decideManualCleaning(input: {
  existingRequestTaskId: string | null;
  activeTaskId: string | null;
  confirmExtra: boolean;
}): ManualCleaningDecision {
  if (input.existingRequestTaskId) {
    return { action: "replay", taskId: input.existingRequestTaskId };
  }

  if (input.activeTaskId && !input.confirmExtra) {
    return { action: "conflict", taskId: input.activeTaskId };
  }

  return { action: "create" };
}

export function describeAssignmentChange(
  currentAgentId: string | null,
  nextAgentId: string | null,
): AssignmentChange {
  if (currentAgentId === nextAgentId) {
    return "unchanged";
  }

  if (currentAgentId && nextAgentId) {
    return "reassigned";
  }

  if (nextAgentId) {
    return "assigned";
  }

  return "unassigned";
}

export function propertyTeamChange(
  existing: { active: boolean } | null,
  action: "add" | "remove",
): PropertyTeamChange {
  if (action === "add") {
    if (!existing) {
      return "add";
    }

    return existing.active ? "duplicate" : "reactivate";
  }

  if (!existing?.active) {
    return "absent";
  }

  return "remove";
}

export function assigneeStatus(agent: { active: boolean } | null) {
  if (!agent) {
    return "unassigned" as const;
  }

  return agent.active ? ("assigned" as const) : ("unavailable" as const);
}
