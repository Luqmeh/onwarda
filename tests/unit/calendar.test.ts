import { describe, expect, it } from "vitest";

import {
  addDays,
  addMonths,
  buildCalendarProjection,
  buildCalendarRange,
  diffDays,
  endOfMonth,
  resolveCalendarAnchor,
  resolveCalendarView,
  startOfWeek,
  todayDateKey,
  type CalendarCleaningInput,
  type CalendarPropertyInput,
  type CalendarReservationInput,
} from "@/lib/calendar/model";

const TODAY = "2026-10-15";

function property(overrides: Partial<CalendarPropertyInput> = {}): CalendarPropertyInput {
  return {
    id: "property-1",
    name: "Riad Atlas",
    status: "active",
    operational_readiness: "ready",
    city: "Marrakesh",
    country: "Morocco",
    ...overrides,
  };
}

function reservation(overrides: Partial<CalendarReservationInput> = {}): CalendarReservationInput {
  return {
    id: "reservation-1",
    property_id: "property-1",
    check_in: "2026-10-10",
    check_out: "2026-10-14",
    status: "upcoming",
    journey_status: null,
    reservation_reference: "ONW-1",
    guestName: "Amina Haddad",
    ...overrides,
  };
}

function cleaningTask(overrides: Partial<CalendarCleaningInput> = {}): CalendarCleaningInput {
  return {
    id: "task-1",
    property_id: "property-1",
    status: "queued",
    created_at: "2026-10-14T09:00:00.000Z",
    started_at: null,
    completed_at: null,
    checkout_date: "2026-10-14",
    ...overrides,
  };
}

function project(input: {
  view?: "month" | "week";
  anchor?: string;
  properties?: CalendarPropertyInput[];
  reservations?: CalendarReservationInput[];
  cleaningTasks?: CalendarCleaningInput[];
}) {
  return buildCalendarProjection({
    view: input.view ?? "month",
    anchor: input.anchor ?? TODAY,
    today: TODAY,
    properties: input.properties ?? [property()],
    reservations: input.reservations ?? [],
    cleaningTasks: input.cleaningTasks ?? [],
  });
}

describe("calendar date helpers", () => {
  it("adds days across month boundaries without timezone drift", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(diffDays("2026-10-01", "2026-10-31")).toBe(30);
  });

  it("clamps month arithmetic to the shortest month", () => {
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
    expect(endOfMonth("2026-02-10")).toBe("2026-02-28");
  });

  it("starts weeks on Monday", () => {
    expect(startOfWeek("2026-10-15")).toBe("2026-10-12");
    expect(startOfWeek("2026-10-11")).toBe("2026-10-05");
  });

  it("reads today from local calendar parts", () => {
    expect(todayDateKey(new Date(2026, 9, 4, 23, 30))).toBe("2026-10-04");
  });
});

describe("calendar range", () => {
  it("covers the whole month in month view", () => {
    const range = buildCalendarRange("month", TODAY, TODAY);

    expect(range.start).toBe("2026-10-01");
    expect(range.end).toBe("2026-10-31");
    expect(range.days).toHaveLength(31);
    expect(range.title).toBe("October 2026");
  });

  it("covers a Monday to Sunday week in week view", () => {
    const range = buildCalendarRange("week", TODAY, TODAY);

    expect(range.start).toBe("2026-10-12");
    expect(range.end).toBe("2026-10-18");
    expect(range.days).toHaveLength(7);
  });

  it("marks today once inside the range and nowhere outside it", () => {
    const current = buildCalendarRange("month", TODAY, TODAY);
    const other = buildCalendarRange("month", "2026-12-02", TODAY);

    expect(current.days.filter((day) => day.isToday)).toHaveLength(1);
    expect(current.todayIndex).toBe(14);
    expect(other.todayIndex).toBeNull();
  });

  it("navigates to the neighbouring period", () => {
    const month = buildCalendarRange("month", TODAY, TODAY);
    const week = buildCalendarRange("week", TODAY, TODAY);

    expect(month.previousAnchor).toBe("2026-09-01");
    expect(month.nextAnchor).toBe("2026-11-01");
    expect(week.previousAnchor).toBe("2026-10-05");
    expect(week.nextAnchor).toBe("2026-10-19");
  });
});

describe("calendar projection", () => {
  it("keeps every active property as a row even with no reservations", () => {
    const result = project({
      properties: [property(), property({ id: "property-2", name: "Dar Sahara" })],
    });

    expect(result.properties.map((row) => row.name)).toEqual(["Riad Atlas", "Dar Sahara"]);
    expect(result.properties.every((row) => row.isQuiet)).toBe(true);
  });

  it("places a stay on its nights, leaving the departure day free", () => {
    const result = project({ reservations: [reservation()] });
    const [segment] = result.properties[0].segments;

    expect(segment.kind).toBe("reservation");
    expect(segment.startDate).toBe("2026-10-10");
    expect(segment.endDate).toBe("2026-10-13");
    expect(segment.startIndex).toBe(9);
    expect(segment.span).toBe(4);
    expect(segment.href).toBe("/app/reservations/reservation-1");
  });

  it("clamps stays that run past the visible window", () => {
    const result = project({
      reservations: [reservation({ check_in: "2026-09-25", check_out: "2026-11-05" })],
    });
    const [segment] = result.properties[0].segments;

    expect(segment.startIndex).toBe(0);
    expect(segment.span).toBe(31);
    expect(segment.continuesBefore).toBe(true);
    expect(segment.continuesAfter).toBe(true);
  });

  it("omits stays entirely outside the visible window", () => {
    const result = project({
      reservations: [reservation({ check_in: "2026-08-01", check_out: "2026-08-05" })],
    });

    expect(result.properties[0].segments).toHaveLength(0);
  });

  it("never renders cancelled reservations or cancelled cleaning tasks", () => {
    const result = project({
      reservations: [reservation({ status: "cancelled" })],
      cleaningTasks: [cleaningTask({ status: "cancelled" })],
    });

    expect(result.properties[0].segments).toHaveLength(0);
    expect(result.summary.reservationCount).toBe(0);
    expect(result.summary.cleaningCount).toBe(0);
  });

  it("renders same-day turnover as two adjacent, non-overlapping stays", () => {
    const result = project({
      reservations: [
        reservation(),
        reservation({ id: "reservation-2", check_in: "2026-10-14", check_out: "2026-10-18", guestName: "Omar Said" }),
      ],
    });
    const row = result.properties[0];
    const [left, right] = row.segments;

    expect(left.startIndex + left.span).toBe(right.startIndex);
    expect(row.conflictCount).toBe(0);
    expect(row.laneCount).toBe(1);
    expect(row.turnoverDates).toEqual(["2026-10-14"]);
  });

  it("flags genuinely overlapping stays and stacks them on separate lanes", () => {
    const result = project({
      reservations: [
        reservation(),
        reservation({ id: "reservation-2", check_in: "2026-10-12", check_out: "2026-10-16" }),
      ],
    });
    const row = result.properties[0];

    expect(row.conflictCount).toBe(1);
    expect(row.segments.every((segment) => segment.conflict)).toBe(true);
    expect(row.laneCount).toBe(2);
    expect(row.segments.map((segment) => segment.lane)).toEqual([0, 1]);
    expect(result.summary.conflictCount).toBe(1);
  });

  it("anchors a cleaning block on the checkout day and holds it open until today", () => {
    const result = project({ cleaningTasks: [cleaningTask()] });
    const [segment] = result.properties[0].segments;

    expect(segment.kind).toBe("cleaning");
    expect(segment.tone).toBe("cleaning-due");
    expect(segment.startDate).toBe("2026-10-14");
    expect(segment.endDate).toBe(TODAY);
    expect(segment.href).toBe("/app/cleaning/task-1");
  });

  it("closes a completed cleaning block on its completion day", () => {
    const result = project({
      cleaningTasks: [
        cleaningTask({ status: "completed", completed_at: "2026-10-14T18:00:00.000Z" }),
      ],
    });
    const [segment] = result.properties[0].segments;

    expect(segment.tone).toBe("cleaned");
    expect(segment.endDate).toBe("2026-10-14");
    expect(segment.span).toBe(1);
  });

  it("falls back to the task creation day when the checkout date is missing", () => {
    const result = project({
      cleaningTasks: [cleaningTask({ checkout_date: null, status: "in_progress" })],
    });
    const [segment] = result.properties[0].segments;

    expect(segment.startDate).toBe("2026-10-14");
    expect(segment.tone).toBe("cleaning-active");
  });

  it("gives every segment a non-colour marker and a screen reader label", () => {
    const result = project({
      reservations: [reservation()],
      cleaningTasks: [cleaningTask()],
    });

    for (const segment of result.properties[0].segments) {
      expect(segment.marker.length).toBeGreaterThan(0);
      expect(segment.screenReaderLabel.length).toBeGreaterThan(0);
      expect(segment.statusLabel.length).toBeGreaterThan(0);
    }
  });

  it("surfaces the operational hold on the property row", () => {
    const result = project({
      properties: [property({ operational_readiness: "cleaning_required" })],
    });

    expect(result.properties[0].readinessLabel).toBe("Cleaning due");
    expect(result.summary.onHoldCount).toBe(1);
  });

  it("builds a mobile agenda of arrivals, departures and turnovers", () => {
    const result = project({
      reservations: [reservation()],
      cleaningTasks: [cleaningTask()],
    });

    expect(result.agenda.map((day) => day.date)).toEqual(["2026-10-10", "2026-10-14"]);
    expect(result.agenda[0].entries[0].label).toContain("arrives");
    expect(result.agenda[1].entries.map((entry) => entry.kind)).toContain("departure");
    expect(result.agenda[1].entries.map((entry) => entry.kind)).toContain("cleaning");
  });

  it("names every agenda entry with its property so mobile stays property-first", () => {
    const result = project({
      properties: [property(), property({ id: "property-2", name: "Dar Sahara" })],
      reservations: [reservation(), reservation({ id: "reservation-2", property_id: "property-2" })],
    });

    expect(result.agenda[0].entries.map((entry) => entry.propertyName)).toEqual([
      "Dar Sahara",
      "Riad Atlas",
    ]);
  });

  it("summarises the visible window", () => {
    const result = project({
      properties: [property(), property({ id: "property-2", name: "Dar Sahara" })],
      reservations: [reservation()],
      cleaningTasks: [cleaningTask()],
    });

    expect(result.summary).toMatchObject({
      propertyCount: 2,
      reservationCount: 1,
      cleaningCount: 1,
      conflictCount: 0,
    });
  });

  it("ignores reservations that belong to a property outside the visible set", () => {
    const result = project({
      properties: [property()],
      reservations: [reservation({ id: "reservation-2", property_id: "archived-property" })],
    });

    expect(result.properties).toHaveLength(1);
    expect(result.properties[0].segments).toHaveLength(0);
    expect(result.agenda).toHaveLength(0);
  });
});

describe("calendar url state", () => {
  it("only accepts the two supported views", () => {
    expect(resolveCalendarView("week")).toBe("week");
    expect(resolveCalendarView("month")).toBe("month");
    expect(resolveCalendarView("timeline")).toBe("month");
    expect(resolveCalendarView(undefined)).toBe("month");
  });

  it("falls back to today for anything that is not a plain date", () => {
    expect(resolveCalendarAnchor("2026-10-01", TODAY)).toBe("2026-10-01");
    expect(resolveCalendarAnchor("2026-13-45", TODAY)).toBe(TODAY);
    expect(resolveCalendarAnchor("'; drop table reservations;--", TODAY)).toBe(TODAY);
    expect(resolveCalendarAnchor(undefined, TODAY)).toBe(TODAY);
  });
});
