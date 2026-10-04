import "server-only";

import { createSupabaseServerClient } from "@/lib/database/server";
import { AppError } from "@/lib/errors";
import { requireWorkspaceView } from "@/lib/tenancy/workspace-access";
import { guestDisplayName } from "@/lib/workspace/format";
import {
  addDays,
  buildCalendarProjection,
  buildCalendarRange,
  CALENDAR_PROPERTY_STATUSES,
  todayDateKey,
  type CalendarCleaningInput,
  type CalendarProjection,
  type CalendarPropertyInput,
  type CalendarReservationInput,
  type CalendarViewMode,
} from "@/lib/calendar/model";

function fail(message: string): never {
  throw new AppError("calendar_unavailable", message, 500);
}

type Embedded<T> = T | T[] | null;

function first<T>(value: Embedded<T>) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

/**
 * Read-only projection of properties, reservations and cleaning tasks onto a date window.
 * Tenant scope comes from the authenticated workspace view, never from the caller.
 */
export async function getWorkspaceCalendar(options: {
  view: CalendarViewMode;
  anchor?: string;
  now?: Date;
}): Promise<CalendarProjection> {
  const view = await requireWorkspaceView();
  const organizationId = view.context.organization.id;
  const supabase = await createSupabaseServerClient();

  const today = todayDateKey(options.now);
  const range = buildCalendarRange(options.view, options.anchor ?? today, today);
  const dayAfterRange = addDays(range.end, 1);

  const [propertiesResult, reservationsResult, cleaningResult] = await Promise.all([
    supabase
      .from("properties")
      .select("id, name, status, operational_readiness, city, country")
      .eq("organization_id", organizationId)
      .in("status", CALENDAR_PROPERTY_STATUSES)
      .order("name"),
    supabase
      .from("reservations")
      .select(
        "id, property_id, check_in, check_out, status, journey_status, reservation_reference, guests(first_name, last_name)",
      )
      .eq("organization_id", organizationId)
      .neq("status", "cancelled")
      .lte("check_in", range.end)
      .gt("check_out", range.start)
      .order("check_in"),
    supabase
      .from("cleaning_tasks")
      .select("id, property_id, status, created_at, started_at, completed_at, reservations(check_out)")
      .eq("organization_id", organizationId)
      .neq("status", "cancelled")
      .or(
        `status.in.(queued,in_progress),and(created_at.gte.${range.start},created_at.lt.${dayAfterRange})`,
      )
      .order("created_at", { ascending: false })
      .limit(400),
  ]);

  if (propertiesResult.error || reservationsResult.error || cleaningResult.error) {
    fail("Unable to load the calendar.");
  }

  const properties: CalendarPropertyInput[] = propertiesResult.data ?? [];

  const reservations: CalendarReservationInput[] = (reservationsResult.data ?? []).map((row) => ({
    id: row.id,
    property_id: row.property_id,
    check_in: row.check_in,
    check_out: row.check_out,
    status: row.status,
    journey_status: row.journey_status,
    reservation_reference: row.reservation_reference,
    guestName: guestDisplayName(first(row.guests)),
  }));

  const cleaningTasks: CalendarCleaningInput[] = (cleaningResult.data ?? []).map((row) => ({
    id: row.id,
    property_id: row.property_id,
    status: row.status,
    created_at: row.created_at,
    started_at: row.started_at,
    completed_at: row.completed_at,
    checkout_date: first(row.reservations)?.check_out ?? null,
  }));

  return buildCalendarProjection({
    view: options.view,
    anchor: range.anchor,
    today,
    properties,
    reservations,
    cleaningTasks,
  });
}
