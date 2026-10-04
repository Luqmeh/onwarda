import { OperationsCalendar } from "@/components/workspace/operations-calendar";
import { getWorkspaceCalendar } from "@/lib/calendar/load";
import type { CalendarViewMode } from "@/lib/calendar/model";
import { AppError } from "@/lib/errors";

type CalendarSectionProps = {
  view: CalendarViewMode;
  anchor: string;
  basePath: string;
  title?: string;
  description?: string;
  expandHref?: string;
};

export async function CalendarSection({
  view,
  anchor,
  basePath,
  title,
  description,
  expandHref,
}: CalendarSectionProps) {
  let calendar;

  try {
    calendar = await getWorkspaceCalendar({ view, anchor });
  } catch (error) {
    if (!(error instanceof AppError) || error.code !== "calendar_unavailable") {
      throw error;
    }

    return (
      <section className="client-surface p-5 sm:p-6" role="alert">
        <p className="onwarda-kicker">{title ?? "Operations calendar"}</p>
        <h2 className="mt-2 text-xl font-medium tracking-tight">The calendar could not be loaded.</h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-onwarda-muted">
          Your stays and turnovers are safe. Refresh the page to try again — nothing has changed in your workspace.
        </p>
      </section>
    );
  }

  return (
    <OperationsCalendar
      calendar={calendar}
      basePath={basePath}
      title={title}
      description={description}
      expandHref={expandHref}
    />
  );
}
