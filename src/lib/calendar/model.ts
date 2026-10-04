import { clientPropertyPath, clientReservationPath, cleaningTaskPath } from "@/config/client";

export type CalendarViewMode = "month" | "week";

export const CALENDAR_VIEW_MODES: CalendarViewMode[] = ["month", "week"];

const MS_PER_DAY = 86_400_000;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function toDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function todayDateKey(now = new Date()) {
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isDateKey(value: string | null | undefined): value is string {
  if (typeof value !== "string" || !DATE_KEY_PATTERN.test(value)) {
    return false;
  }

  const parsed = parseDateKey(value);

  // Date.UTC rolls overflowing parts forward, so only a clean round trip is a real date.
  return !Number.isNaN(parsed.getTime()) && toDateKey(parsed) === value;
}

export function addDays(key: string, days: number) {
  return toDateKey(new Date(parseDateKey(key).getTime() + days * MS_PER_DAY));
}

export function diffDays(from: string, to: string) {
  return Math.round((parseDateKey(to).getTime() - parseDateKey(from).getTime()) / MS_PER_DAY);
}

export function addMonths(key: string, months: number) {
  const date = parseDateKey(key);
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return toDateKey(target);
}

export function startOfMonth(key: string) {
  return `${key.slice(0, 7)}-01`;
}

export function endOfMonth(key: string) {
  const date = parseDateKey(key);
  return toDateKey(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)));
}

/** Weeks start on Monday. */
export function startOfWeek(key: string) {
  const date = parseDateKey(key);
  const offset = (date.getUTCDay() + 6) % 7;
  return addDays(key, -offset);
}

function clampKey(value: string, min: string, max: string) {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}

function formatRangeDay(key: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(parseDateKey(key));
}

function formatMonthTitle(key: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(parseDateKey(key));
}

function formatFullDay(key: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(parseDateKey(key));
}

export type CalendarDay = {
  date: string;
  dayLabel: string;
  weekdayLabel: string;
  fullLabel: string;
  isToday: boolean;
  isPast: boolean;
  isWeekend: boolean;
  startsMonth: boolean;
};

export type CalendarRange = {
  view: CalendarViewMode;
  anchor: string;
  start: string;
  end: string;
  title: string;
  days: CalendarDay[];
  previousAnchor: string;
  nextAnchor: string;
  todayIndex: number | null;
};

export function buildCalendarRange(view: CalendarViewMode, anchor: string, today: string): CalendarRange {
  const start = view === "month" ? startOfMonth(anchor) : startOfWeek(anchor);
  const end = view === "month" ? endOfMonth(anchor) : addDays(start, 6);
  const length = diffDays(start, end) + 1;

  const days: CalendarDay[] = Array.from({ length }, (_unused, index) => {
    const date = addDays(start, index);
    const weekday = parseDateKey(date).getUTCDay();

    return {
      date,
      dayLabel: `${parseDateKey(date).getUTCDate()}`,
      weekdayLabel: new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "narrow" }).format(
        parseDateKey(date),
      ),
      fullLabel: formatFullDay(date),
      isToday: date === today,
      isPast: date < today,
      isWeekend: weekday === 0 || weekday === 6,
      startsMonth: date.endsWith("-01"),
    };
  });

  const todayIndex = days.findIndex((day) => day.isToday);

  return {
    view,
    anchor,
    start,
    end,
    title:
      view === "month"
        ? formatMonthTitle(start)
        : `${formatRangeDay(start)} – ${formatRangeDay(end)}, ${parseDateKey(end).getUTCFullYear()}`,
    days,
    previousAnchor: view === "month" ? addMonths(start, -1) : addDays(start, -7),
    nextAnchor: view === "month" ? addMonths(start, 1) : addDays(start, 7),
    todayIndex: todayIndex === -1 ? null : todayIndex,
  };
}

export type CalendarSegmentKind = "reservation" | "cleaning";

export type CalendarSegmentTone = "stay" | "arriving" | "departed" | "cleaning-due" | "cleaning-active" | "cleaned";

export type CalendarSegment = {
  id: string;
  kind: CalendarSegmentKind;
  propertyId: string;
  startDate: string;
  endDate: string;
  startIndex: number;
  span: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
  lane: number;
  tone: CalendarSegmentTone;
  /** Short non-colour marker so status is never conveyed by colour alone. */
  marker: string;
  label: string;
  statusLabel: string;
  detail: string;
  href: string;
  conflict: boolean;
  screenReaderLabel: string;
};

export type CalendarPropertyRow = {
  id: string;
  name: string;
  location: string | null;
  status: string;
  readiness: string;
  readinessLabel: string;
  href: string;
  segments: CalendarSegment[];
  laneCount: number;
  conflictCount: number;
  turnoverDates: string[];
  isQuiet: boolean;
};

export type CalendarAgendaEntry = {
  id: string;
  propertyId: string;
  propertyName: string;
  kind: CalendarSegmentKind | "departure";
  tone: CalendarSegmentTone;
  marker: string;
  label: string;
  detail: string;
  href: string;
};

export type CalendarAgendaDay = {
  date: string;
  label: string;
  isToday: boolean;
  entries: CalendarAgendaEntry[];
};

export type CalendarLegendItem = {
  tone: CalendarSegmentTone;
  marker: string;
  label: string;
};

export const CALENDAR_LEGEND: CalendarLegendItem[] = [
  { tone: "arriving", marker: "→", label: "Arriving" },
  { tone: "stay", marker: "●", label: "In stay" },
  { tone: "departed", marker: "✓", label: "Completed stay" },
  { tone: "cleaning-due", marker: "!", label: "Cleaning due (property on hold)" },
  { tone: "cleaning-active", marker: "◐", label: "Cleaning in progress" },
  { tone: "cleaned", marker: "✓", label: "Cleaned and ready" },
];

export type CalendarSummary = {
  propertyCount: number;
  reservationCount: number;
  cleaningCount: number;
  conflictCount: number;
  onHoldCount: number;
};

export type CalendarProjection = {
  range: CalendarRange;
  properties: CalendarPropertyRow[];
  agenda: CalendarAgendaDay[];
  legend: CalendarLegendItem[];
  summary: CalendarSummary;
};

export type CalendarPropertyInput = {
  id: string;
  name: string;
  status: string;
  operational_readiness: string | null;
  city: string | null;
  country: string | null;
};

export type CalendarReservationInput = {
  id: string;
  property_id: string;
  check_in: string;
  check_out: string;
  status: string;
  journey_status: string | null;
  reservation_reference: string | null;
  guestName: string;
};

export type CalendarCleaningInput = {
  id: string;
  property_id: string;
  status: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  checkout_date: string | null;
};

export const CALENDAR_PROPERTY_STATUSES = ["draft", "active", "inactive"];

function readinessLabel(readiness: string) {
  if (readiness === "cleaning_required") {
    return "Cleaning due";
  }

  if (readiness === "cleaning_in_progress") {
    return "Cleaning in progress";
  }

  return "Ready";
}

function reservationTone(reservation: CalendarReservationInput, today: string): CalendarSegmentTone {
  if (reservation.check_in === today) {
    return "arriving";
  }

  if (reservation.status === "completed" || reservation.journey_status === "checked_out") {
    return "departed";
  }

  return "stay";
}

function reservationMarker(tone: CalendarSegmentTone) {
  return CALENDAR_LEGEND.find((item) => item.tone === tone)?.marker ?? "●";
}

function cleaningTone(status: string): CalendarSegmentTone {
  if (status === "completed") {
    return "cleaned";
  }

  if (status === "in_progress") {
    return "cleaning-active";
  }

  return "cleaning-due";
}

function cleaningStatusLabel(tone: CalendarSegmentTone) {
  return CALENDAR_LEGEND.find((item) => item.tone === tone)?.label ?? "Cleaning";
}

function assignLanes(segments: CalendarSegment[]) {
  const laneEnds: string[] = [];

  for (const segment of segments) {
    let lane = laneEnds.findIndex((end) => end < segment.startDate);

    if (lane === -1) {
      lane = laneEnds.length;
    }

    laneEnds[lane] = segment.endDate;
    segment.lane = lane;
  }

  return laneEnds.length;
}

function overlaps(left: CalendarSegment, right: CalendarSegment) {
  return left.startDate <= right.endDate && right.startDate <= left.endDate;
}

export function buildCalendarProjection(input: {
  view: CalendarViewMode;
  anchor: string;
  today: string;
  properties: CalendarPropertyInput[];
  reservations: CalendarReservationInput[];
  cleaningTasks: CalendarCleaningInput[];
}): CalendarProjection {
  const range = buildCalendarRange(input.view, input.anchor, input.today);
  const segmentsByProperty = new Map<string, CalendarSegment[]>();

  const push = (propertyId: string, segment: CalendarSegment) => {
    const existing = segmentsByProperty.get(propertyId);

    if (existing) {
      existing.push(segment);
      return;
    }

    segmentsByProperty.set(propertyId, [segment]);
  };

  for (const reservation of input.reservations) {
    if (reservation.status === "cancelled") {
      continue;
    }

    // A stay occupies nights, so the departure day belongs to the next arrival.
    const firstNight = reservation.check_in;
    const lastNight = addDays(reservation.check_out, -1);

    if (lastNight < range.start || firstNight > range.end) {
      continue;
    }

    const startDate = clampKey(firstNight, range.start, range.end);
    const endDate = clampKey(lastNight, range.start, range.end);
    const tone = reservationTone(reservation, input.today);
    const nights = diffDays(firstNight, reservation.check_out);
    const detail = `${formatRangeDay(firstNight)} – ${formatRangeDay(reservation.check_out)} · ${nights} ${
      nights === 1 ? "night" : "nights"
    }`;

    push(reservation.property_id, {
      id: `reservation-${reservation.id}`,
      kind: "reservation",
      propertyId: reservation.property_id,
      startDate,
      endDate,
      startIndex: diffDays(range.start, startDate),
      span: diffDays(startDate, endDate) + 1,
      continuesBefore: firstNight < range.start,
      continuesAfter: lastNight > range.end,
      lane: 0,
      tone,
      marker: reservationMarker(tone),
      label: reservation.guestName,
      statusLabel: CALENDAR_LEGEND.find((item) => item.tone === tone)?.label ?? "In stay",
      detail,
      href: clientReservationPath(reservation.id),
      conflict: false,
      screenReaderLabel: `${reservation.guestName}, ${detail}`,
    });
  }

  for (const task of input.cleaningTasks) {
    if (task.status === "cancelled") {
      continue;
    }

    const anchorDate = task.checkout_date ?? task.created_at.slice(0, 10);
    const closingDate = task.completed_at ? task.completed_at.slice(0, 10) : input.today;
    const firstDay = anchorDate;
    const lastDay = closingDate > anchorDate ? closingDate : anchorDate;

    if (lastDay < range.start || firstDay > range.end) {
      continue;
    }

    const startDate = clampKey(firstDay, range.start, range.end);
    const endDate = clampKey(lastDay, range.start, range.end);
    const tone = cleaningTone(task.status);
    const statusLabel = cleaningStatusLabel(tone);

    push(task.property_id, {
      id: `cleaning-${task.id}`,
      kind: "cleaning",
      propertyId: task.property_id,
      startDate,
      endDate,
      startIndex: diffDays(range.start, startDate),
      span: diffDays(startDate, endDate) + 1,
      continuesBefore: firstDay < range.start,
      continuesAfter: lastDay > range.end,
      lane: 0,
      tone,
      marker: CALENDAR_LEGEND.find((item) => item.tone === tone)?.marker ?? "!",
      label: statusLabel,
      statusLabel,
      detail: `Turnover from ${formatRangeDay(anchorDate)}`,
      href: cleaningTaskPath(task.id),
      conflict: false,
      screenReaderLabel: `${statusLabel}, turnover from ${formatRangeDay(anchorDate)}`,
    });
  }

  const properties = input.properties.map((property) => {
    const segments = (segmentsByProperty.get(property.id) ?? []).sort((left, right) => {
      if (left.startDate !== right.startDate) {
        return left.startDate < right.startDate ? -1 : 1;
      }

      if (left.kind !== right.kind) {
        return left.kind === "reservation" ? -1 : 1;
      }

      return left.id < right.id ? -1 : 1;
    });

    const stays = segments.filter((segment) => segment.kind === "reservation");
    let conflictCount = 0;

    for (let index = 0; index < stays.length; index += 1) {
      for (let other = index + 1; other < stays.length; other += 1) {
        if (overlaps(stays[index], stays[other])) {
          stays[index].conflict = true;
          stays[other].conflict = true;
          conflictCount += 1;
        }
      }
    }

    const departureDates = new Set(stays.map((segment) => addDays(segment.endDate, 1)));
    const turnoverDates = stays
      .filter((segment) => departureDates.has(segment.startDate))
      .map((segment) => segment.startDate);

    const readiness = property.operational_readiness ?? "ready";

    return {
      id: property.id,
      name: property.name,
      location: [property.city, property.country].filter(Boolean).join(", ") || null,
      status: property.status,
      readiness,
      readinessLabel: readinessLabel(readiness),
      href: clientPropertyPath(property.id),
      segments,
      laneCount: Math.max(assignLanes(segments), 1),
      conflictCount,
      turnoverDates: [...new Set(turnoverDates)],
      isQuiet: segments.length === 0,
    } satisfies CalendarPropertyRow;
  });

  return {
    range,
    properties,
    agenda: buildCalendarAgenda(range, properties, input.reservations, input.today),
    legend: CALENDAR_LEGEND,
    summary: {
      propertyCount: properties.length,
      reservationCount: properties.reduce(
        (total, property) => total + property.segments.filter((segment) => segment.kind === "reservation").length,
        0,
      ),
      cleaningCount: properties.reduce(
        (total, property) => total + property.segments.filter((segment) => segment.kind === "cleaning").length,
        0,
      ),
      conflictCount: properties.reduce((total, property) => total + property.conflictCount, 0),
      onHoldCount: properties.filter((property) => property.readiness !== "ready").length,
    },
  };
}

function buildCalendarAgenda(
  range: CalendarRange,
  properties: CalendarPropertyRow[],
  reservations: CalendarReservationInput[],
  today: string,
): CalendarAgendaDay[] {
  const names = new Map(properties.map((property) => [property.id, property.name]));
  const byDate = new Map<string, CalendarAgendaEntry[]>();

  const add = (date: string, entry: CalendarAgendaEntry) => {
    if (date < range.start || date > range.end) {
      return;
    }

    const existing = byDate.get(date);

    if (existing) {
      existing.push(entry);
      return;
    }

    byDate.set(date, [entry]);
  };

  for (const reservation of reservations) {
    if (reservation.status === "cancelled" || !names.has(reservation.property_id)) {
      continue;
    }

    const propertyName = names.get(reservation.property_id) ?? "Property";

    add(reservation.check_in, {
      id: `arrival-${reservation.id}`,
      propertyId: reservation.property_id,
      propertyName,
      kind: "reservation",
      tone: "arriving",
      marker: "→",
      label: `${reservation.guestName} arrives`,
      detail: `Until ${formatRangeDay(reservation.check_out)}`,
      href: clientReservationPath(reservation.id),
    });

    add(reservation.check_out, {
      id: `departure-${reservation.id}`,
      propertyId: reservation.property_id,
      propertyName,
      kind: "departure",
      tone: "departed",
      marker: "←",
      label: `${reservation.guestName} departs`,
      detail: `Stayed from ${formatRangeDay(reservation.check_in)}`,
      href: clientReservationPath(reservation.id),
    });
  }

  for (const property of properties) {
    for (const segment of property.segments) {
      if (segment.kind !== "cleaning") {
        continue;
      }

      add(segment.startDate, {
        id: segment.id,
        propertyId: property.id,
        propertyName: property.name,
        kind: "cleaning",
        tone: segment.tone,
        marker: segment.marker,
        label: segment.statusLabel,
        detail: segment.detail,
        href: segment.href,
      });
    }
  }

  return [...byDate.entries()]
    .sort((left, right) => (left[0] < right[0] ? -1 : 1))
    .map(([date, entries]) => ({
      date,
      label: formatFullDay(date),
      isToday: date === today,
      entries: entries.sort((left, right) => left.propertyName.localeCompare(right.propertyName)),
    }));
}

export function resolveCalendarView(value: string | string[] | undefined): CalendarViewMode {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === "week" ? "week" : "month";
}

export function resolveCalendarAnchor(value: string | string[] | undefined, today: string) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return isDateKey(candidate) ? candidate : today;
}
