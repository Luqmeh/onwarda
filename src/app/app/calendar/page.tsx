import { Suspense } from "react";

import { CalendarSection } from "@/components/workspace/calendar-section";
import { ClientPageHeader } from "@/components/workspace/client-ui";
import { OperationsCalendarSkeleton } from "@/components/workspace/operations-calendar";
import { CLIENT_ROUTES } from "@/config/client";
import { resolveCalendarAnchor, resolveCalendarView, todayDateKey } from "@/lib/calendar/model";

export const metadata = {
  title: "Calendar",
};

export default async function ClientCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const query = await searchParams;
  const today = todayDateKey();
  const view = resolveCalendarView(query.view);
  const anchor = resolveCalendarAnchor(query.date, today);

  return (
    <div className="space-y-6">
      <ClientPageHeader
        title="Calendar"
        description="Every active property, stay and turnover on one timeline. Open a block to go straight to the reservation or cleaning task."
      />
      <Suspense key={`${view}-${anchor}`} fallback={<OperationsCalendarSkeleton />}>
        <CalendarSection
          view={view}
          anchor={anchor}
          basePath={CLIENT_ROUTES.calendar}
          title="Property timeline"
        />
      </Suspense>
    </div>
  );
}
