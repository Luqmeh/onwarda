import type { CSSProperties } from "react";
import Link from "next/link";

import { CalendarRefresh } from "@/components/workspace/calendar-refresh";
import { ClientEmptyState } from "@/components/workspace/client-ui";
import { CLIENT_ROUTES } from "@/config/client";
import type { CalendarProjection, CalendarSegment, CalendarViewMode } from "@/lib/calendar/model";
import { cn } from "@/lib/utils";

type OperationsCalendarProps = {
  calendar: CalendarProjection;
  /** Route the navigation links point back to, so the calendar works on /app and /app/calendar. */
  basePath: string;
  title?: string;
  description?: string;
  expandHref?: string;
};

function calendarHref(basePath: string, view: CalendarViewMode, date: string) {
  return `${basePath}?view=${view}&date=${date}`;
}

function segmentStyle(segment: CalendarSegment): CSSProperties {
  return {
    gridColumn: `${segment.startIndex + 1} / span ${segment.span}`,
    gridRow: segment.lane + 1,
  };
}

function NavLink({
  href,
  label,
  children,
  active,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex h-8 items-center justify-center rounded-[var(--onwarda-radius-sm)] border px-3 text-xs font-medium transition-colors",
        active
          ? "border-transparent bg-[color-mix(in_srgb,var(--client-primary)_14%,var(--onwarda-white))] text-onwarda-charcoal"
          : "text-onwarda-muted hover:text-onwarda-charcoal",
      )}
    >
      {children}
    </Link>
  );
}

export function OperationsCalendar({
  calendar,
  basePath,
  title = "Operations calendar",
  description,
  expandHref,
}: OperationsCalendarProps) {
  const { range, properties, agenda, legend, summary } = calendar;
  const dayCount = range.days.length;

  return (
    <section className="client-surface calendar p-5 sm:p-6" data-view={range.view}>
      <CalendarRefresh />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="onwarda-kicker">{title}</p>
          <h2 className="mt-2 text-2xl font-medium tracking-tight">{range.title}</h2>
          <p className="mt-1 text-sm text-onwarda-muted">
            {description ??
              `${summary.propertyCount === 1 ? "1 property" : `${summary.propertyCount} properties`} · ${
                summary.reservationCount === 1 ? "1 stay" : `${summary.reservationCount} stays`
              } · ${summary.cleaningCount === 1 ? "1 turnover" : `${summary.cleaningCount} turnovers`}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1" role="group" aria-label="Calendar view">
            <NavLink
              href={calendarHref(basePath, "month", range.anchor)}
              label="Month view"
              active={range.view === "month"}
            >
              Month
            </NavLink>
            <NavLink
              href={calendarHref(basePath, "week", range.anchor)}
              label="Week view"
              active={range.view === "week"}
            >
              Week
            </NavLink>
          </div>
          <div className="flex items-center gap-1" role="group" aria-label="Calendar period">
            <NavLink
              href={calendarHref(basePath, range.view, range.previousAnchor)}
              label={range.view === "month" ? "Previous month" : "Previous week"}
            >
              <span aria-hidden="true">←</span>
            </NavLink>
            <NavLink href={basePath + `?view=${range.view}`} label="Jump to today">
              Today
            </NavLink>
            <NavLink
              href={calendarHref(basePath, range.view, range.nextAnchor)}
              label={range.view === "month" ? "Next month" : "Next week"}
            >
              <span aria-hidden="true">→</span>
            </NavLink>
          </div>
          {expandHref ? (
            <NavLink href={expandHref} label="Open the full calendar">
              Expand
            </NavLink>
          ) : null}
        </div>
      </div>

      {summary.conflictCount > 0 ? (
        <p
          className="mt-4 rounded-[var(--onwarda-radius-sm)] bg-onwarda-coral/15 px-3 py-2 text-sm text-onwarda-charcoal"
          role="status"
        >
          {summary.conflictCount === 1
            ? "1 overlapping stay needs review."
            : `${summary.conflictCount} overlapping stays need review.`}
        </p>
      ) : null}

      {properties.length === 0 ? (
        <div className="mt-5">
          <ClientEmptyState
            title="Your calendar will fill in once you add a property."
            description="Every active property gets its own row here, with stays and turnovers laid out across the dates."
            action={
              <Link
                href={CLIENT_ROUTES.propertyNew}
                className="text-sm font-medium text-onwarda-olive underline underline-offset-4"
              >
                Add a property
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div
            className="calendar-viewport mt-5 hidden md:block"
            tabIndex={0}
            role="region"
            aria-label={`Property timeline for ${range.title}`}
          >
            <div className="calendar-grid" style={{ "--calendar-days": dayCount } as CSSProperties}>
              <div className="calendar-row calendar-row--head">
                <div className="calendar-corner text-[0.68rem] tracking-[0.14em] text-onwarda-muted uppercase">
                  Property
                </div>
                <div className="calendar-track" style={{ gridAutoRows: "auto", padding: 0 }}>
                  {range.days.map((day, index) => (
                    <div
                      key={day.date}
                      className="calendar-day-head"
                      data-today={day.isToday}
                      style={{ gridColumn: `${index + 1} / span 1`, gridRow: 1 }}
                    >
                      <span aria-hidden="true">{day.weekdayLabel}</span>
                      <span className="calendar-day-number">{day.dayLabel}</span>
                      <span className="sr-only">
                        {day.fullLabel}
                        {day.isToday ? " (today)" : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {properties.map((property) => (
                <div key={property.id} className="calendar-row">
                  <div className="calendar-property">
                    <Link
                      href={property.href}
                      className="block truncate text-sm font-medium hover:text-onwarda-olive"
                      title={property.name}
                    >
                      {property.name}
                    </Link>
                    <p className="truncate text-[0.7rem] text-onwarda-muted">
                      {property.readiness === "ready" ? property.location ?? "Ready" : property.readinessLabel}
                    </p>
                  </div>
                  <div className="calendar-track">
                    <div className="calendar-gridlines" aria-hidden="true">
                      {range.days.map((day) => (
                        <div
                          key={day.date}
                          className="calendar-gridline"
                          data-today={day.isToday}
                          data-weekend={day.isWeekend}
                        />
                      ))}
                    </div>

                    {property.segments.length === 0 ? (
                      <p
                        className="col-span-full self-center pl-3 text-[0.7rem] text-onwarda-muted"
                        style={{ gridRow: 1 }}
                      >
                        No stays in this period
                      </p>
                    ) : (
                      property.segments.map((segment) => (
                        <Link
                          key={segment.id}
                          href={segment.href}
                          className="calendar-segment"
                          style={segmentStyle(segment)}
                          data-tone={segment.tone}
                          data-conflict={segment.conflict}
                          data-continues-before={segment.continuesBefore}
                          data-continues-after={segment.continuesAfter}
                          title={`${property.name} — ${segment.screenReaderLabel}`}
                        >
                          <span className="calendar-marker" aria-hidden="true">
                            {segment.marker}
                          </span>
                          <span className="truncate">{segment.label}</span>
                          <span className="sr-only">
                            {property.name}, {segment.screenReaderLabel}
                            {segment.conflict ? ", overlapping another stay" : ""}
                          </span>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 md:hidden">
            {agenda.length === 0 ? (
              <ClientEmptyState
                title="Nothing scheduled in this period."
                description="Arrivals, departures and turnovers will appear here as soon as they are booked."
              />
            ) : (
              <ol className="space-y-4">
                {agenda.map((day) => (
                  <li key={day.date}>
                    <p
                      className={cn(
                        "text-[0.68rem] tracking-[0.14em] uppercase",
                        day.isToday ? "text-onwarda-charcoal" : "text-onwarda-muted",
                      )}
                    >
                      {day.label}
                      {day.isToday ? " · Today" : ""}
                    </p>
                    <ul className="mt-2 space-y-2">
                      {day.entries.map((entry) => (
                        <li key={entry.id}>
                          <Link
                            href={entry.href}
                            className="flex items-center gap-3 rounded-[var(--onwarda-radius-sm)] bg-[color-mix(in_srgb,var(--client-background)_75%,var(--client-secondary))] px-3 py-2.5"
                          >
                            <span
                              className="calendar-segment calendar-legend-swatch"
                              data-tone={entry.tone}
                              aria-hidden="true"
                            >
                              {entry.marker}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{entry.propertyName}</span>
                              <span className="block truncate text-xs text-onwarda-muted">
                                {entry.label} · {entry.detail}
                              </span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </>
      )}

      <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.7rem] text-onwarda-muted">
        {legend.map((item) => (
          <li key={item.tone} className="flex items-center gap-1.5">
            <span className="calendar-segment calendar-legend-swatch" data-tone={item.tone} aria-hidden="true">
              {item.marker}
            </span>
            {item.label}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function OperationsCalendarSkeleton() {
  return (
    <section className="client-surface p-5 sm:p-6" aria-busy="true" aria-label="Loading the operations calendar">
      <div className="h-3 w-28 rounded-full bg-onwarda-cream" />
      <div className="mt-3 h-7 w-48 rounded-full bg-onwarda-cream" />
      <div className="mt-5 space-y-2 rounded-[var(--onwarda-radius)] border p-3">
        {Array.from({ length: 7 }, (_unused, index) => (
          <div key={index} className="flex items-center gap-3">
            <div className="h-5 w-36 shrink-0 rounded-full bg-onwarda-cream" />
            <div
              className="h-5 flex-1 rounded-full bg-[color-mix(in_srgb,var(--client-background)_70%,var(--client-secondary))]"
              style={{ opacity: 1 - index * 0.1 }}
            />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading the operations calendar.</span>
    </section>
  );
}
