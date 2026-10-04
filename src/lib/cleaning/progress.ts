export type ChecklistItemState = {
  required: boolean;
  completedAt: string | null;
};

export function checklistProgress(items: ChecklistItemState[]) {
  const required = items.filter((item) => item.required);
  const completed = required.filter((item) => item.completedAt).length;

  return {
    completed,
    total: required.length,
    ready: required.length > 0 && completed === required.length,
  };
}

export function canFinishCleaning(input: {
  status: string;
  items: ChecklistItemState[];
  confirmCleaning: boolean;
  confirmLeft: boolean;
}) {
  if (input.status !== "in_progress") {
    return false;
  }

  if (!input.confirmCleaning || !input.confirmLeft) {
    return false;
  }

  return checklistProgress(input.items).ready;
}

export function readinessAfterTasks(
  statuses: Array<"queued" | "in_progress" | "completed" | "cancelled">,
) {
  if (statuses.includes("in_progress")) {
    return "cleaning_in_progress" as const;
  }

  if (statuses.includes("queued")) {
    return "cleaning_required" as const;
  }

  return "ready" as const;
}
