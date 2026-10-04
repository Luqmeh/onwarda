import { describe, expect, it } from "vitest";

import {
  assigneeStatus,
  decideManualCleaning,
  describeAssignmentChange,
  manualCleaningDraft,
  propertyTeamChange,
  selectDefaultCleaner,
} from "@/lib/cleaning/assignment";

const PROPERTY = "11111111-1111-4111-8111-111111111111";
const FATIMA = "22222222-2222-4222-8222-222222222222";
const OMAR = "33333333-3333-4333-8333-333333333333";
const SARA = "44444444-4444-4444-8444-444444444444";
const TASK = "55555555-5555-4555-8555-555555555555";
const KEY = "66666666-6666-4666-8666-666666666666";

describe("manual cleaning", () => {
  it("creates a queued manual task with no reservation", () => {
    const draft = manualCleaningDraft({
      propertyId: PROPERTY,
      assigneeId: FATIMA,
      requestKey: KEY,
      confirmExtra: false,
    });

    expect(draft.triggerType).toBe("manual");
    expect(draft.status).toBe("queued");
    expect(draft.reservationId).toBeNull();
    expect(draft.propertyId).toBe(PROPERTY);
  });

  it("keeps the task when no default cleaner is selected", () => {
    const draft = manualCleaningDraft({
      propertyId: PROPERTY,
      assigneeId: null,
      requestKey: KEY,
      confirmExtra: false,
    });

    expect(draft.assigneeId).toBeNull();
    expect(assigneeStatus(null)).toBe("unassigned");
  });

  it("replays a repeated submit and blocks a second open task until confirmed", () => {
    expect(
      decideManualCleaning({
        existingRequestTaskId: TASK,
        activeTaskId: TASK,
        confirmExtra: false,
      }),
    ).toEqual({ action: "replay", taskId: TASK });

    expect(
      decideManualCleaning({
        existingRequestTaskId: null,
        activeTaskId: TASK,
        confirmExtra: false,
      }),
    ).toEqual({ action: "conflict", taskId: TASK });

    expect(
      decideManualCleaning({
        existingRequestTaskId: null,
        activeTaskId: null,
        confirmExtra: false,
      }).action,
    ).toBe("create");

    expect(
      decideManualCleaning({
        existingRequestTaskId: null,
        activeTaskId: TASK,
        confirmExtra: true,
      }).action,
    ).toBe("create");
  });
});

describe("task assignment", () => {
  it("distinguishes assign, reassign, and unassign without inventing a new task", () => {
    expect(describeAssignmentChange(null, FATIMA)).toBe("assigned");
    expect(describeAssignmentChange(FATIMA, OMAR)).toBe("reassigned");
    expect(describeAssignmentChange(FATIMA, null)).toBe("unassigned");
    expect(describeAssignmentChange(FATIMA, FATIMA)).toBe("unchanged");
  });

  it("treats a disabled assignee as unavailable rather than unassigned", () => {
    expect(assigneeStatus({ active: false })).toBe("unavailable");
    expect(assigneeStatus({ active: true })).toBe("assigned");
  });
});

describe("property default cleaners", () => {
  it("picks the earliest active assignment", () => {
    expect(
      selectDefaultCleaner([
        { assignmentId: "b", agentId: OMAR, createdAt: "2026-10-02T00:00:00.000Z", active: true },
        { assignmentId: "a", agentId: FATIMA, createdAt: "2026-10-01T00:00:00.000Z", active: true },
        { assignmentId: "c", agentId: SARA, createdAt: "2026-09-01T00:00:00.000Z", active: false },
      ]),
    ).toBe(FATIMA);
  });

  it("breaks ties by assignment id", () => {
    expect(
      selectDefaultCleaner([
        { assignmentId: "b", agentId: OMAR, createdAt: "2026-10-01T00:00:00.000Z", active: true },
        { assignmentId: "a", agentId: FATIMA, createdAt: "2026-10-01T00:00:00.000Z", active: true },
      ]),
    ).toBe(FATIMA);
  });

  it("adds, reactivates, and refuses a duplicate active assignment", () => {
    expect(propertyTeamChange(null, "add")).toBe("add");
    expect(propertyTeamChange({ active: false }, "add")).toBe("reactivate");
    expect(propertyTeamChange({ active: true }, "add")).toBe("duplicate");
  });

  it("removes an active default without touching anyone else", () => {
    expect(propertyTeamChange({ active: true }, "remove")).toBe("remove");
    expect(propertyTeamChange({ active: false }, "remove")).toBe("absent");
    expect(propertyTeamChange(null, "remove")).toBe("absent");
  });
});
