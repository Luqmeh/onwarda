import { Suspense } from "react";

import { CalendarSection } from "@/components/workspace/calendar-section";
import { ClientPageHeader } from "@/components/workspace/client-ui";
import { OperationsCalendarSkeleton } from "@/components/workspace/operations-calendar";
import { CLIENT_ROUTES } from "@/config/client";
import { getRequestI18n } from "@/i18n/get-locale";
import { clientMetadata } from "@/i18n/page-title";
import { resolveCalendarAnchor, resolveCalendarView, todayDateKey } from "@/lib/calendar/model";

export async function generateMetadata() {
  return clientMetadata((messages) => ({ title: messages.titles.calendar }));
}

export default async function ClientCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const query = await searchParams;
  const { messages } = await getRequestI18n();
  const today = todayDateKey();
  const view = resolveCalendarView(query.view);
  const anchor = resolveCalendarAnchor(query.date, today);

  return (
    <div className="space-y-6">
      <ClientPageHeader
        title={messages.nav.calendar}
        description={messages.screens.calendar}
      />
      <Suspense key={`${view}-${anchor}`} fallback={<OperationsCalendarSkeleton />}>
        <CalendarSection
          view={view}
          anchor={anchor}
          basePath={CLIENT_ROUTES.calendar}
          title={messages.screens.propertyTimeline}
        />
      </Suspense>
    </div>
  );
}
