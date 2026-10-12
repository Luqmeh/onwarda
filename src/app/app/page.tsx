import { Suspense } from "react";
import Link from "next/link";

import { CalendarSection } from "@/components/workspace/calendar-section";
import {
  ClientEmptyState,
  ClientMetricCard,
  ClientPageHeader,
  ClientSectionCard,
  ClientStatusBadge,
} from "@/components/workspace/client-ui";
import { OperationsCalendarSkeleton } from "@/components/workspace/operations-calendar";
import {
  CLIENT_ROUTES,
  clientGuestPath,
  clientPropertyPath,
  clientReservationPath,
} from "@/config/client";
import { resolveCalendarAnchor, resolveCalendarView, todayDateKey } from "@/lib/calendar/model";
import { loadOnboardingSnapshot, readOnboardingGate } from "@/lib/onboarding/load";
import { getRequestI18n } from "@/i18n/get-locale";
import { clientMetadata } from "@/i18n/page-title";
import { fillMessage, formattingLocale } from "@/i18n/locale";
import { getWorkspaceDashboard } from "@/lib/workspace/data";
import {
  formatDate,
  formatStay,
  guestDisplayName,
  humanizeToken,
  labeledStatus,
  propertyLocation,
  statusTone,
} from "@/lib/workspace/format";

export async function generateMetadata() {
  return clientMetadata((messages) => ({ title: messages.titles.overview }));
}

export default async function ClientOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; view?: string; date?: string }>;
}) {
  const query = await searchParams;
  const { locale, messages } = await getRequestI18n();
  const dates = formattingLocale(locale);
  const statusLabels = messages.status;
  const dashboard = await getWorkspaceDashboard();
  const setup = await readOnboardingGate()
    .then(async (gate) => {
      if (gate.status !== "completed") {
        return [];
      }

      const snapshot = await loadOnboardingSnapshot(false);
      return snapshot.checklist.filter((item) => item.optional && !item.done);
    })
    .catch(() => []);
  const today = todayDateKey();
  const calendarView = resolveCalendarView(query.view);
  const calendarAnchor = resolveCalendarAnchor(query.date, today);
  const arrivingToday = dashboard.upcomingReservations.filter((reservation) =>
    reservation.checkIn.startsWith(today),
  );
  const nextArrival = arrivingToday[0] ?? dashboard.upcomingReservations[0] ?? null;
  const attention = dashboard.openIssues.length + arrivingToday.length;
  const greetingHour = new Date().getHours();
  const greeting =
    greetingHour < 12
      ? messages.overview.goodMorning
      : greetingHour < 18
        ? messages.overview.goodAfternoon
        : messages.overview.goodEvening;

  return (
    <div className="space-y-8">
      <ClientPageHeader
        kicker={dashboard.organizationName}
        title={greeting}
        description={messages.overview.today}
      />
      {query.notice === "payment-setup" ? (
        <p className="rounded-[var(--onwarda-radius)] border bg-onwarda-white px-4 py-3 text-sm" role="status">
          {messages.overview.paymentSetup}
        </p>
      ) : null}
      {setup.length > 0 ? (
        <section className="client-surface p-5 sm:p-6">
          <h2 className="text-base font-medium">{messages.overview.completeWorkspace}</h2>
          <ul className="mt-3 space-y-1 text-sm text-onwarda-muted">
            {setup.map((item) => (
              <li key={item.label}>{item.label}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <Suspense key={`${calendarView}-${calendarAnchor}`} fallback={<OperationsCalendarSkeleton />}>
        <CalendarSection
          view={calendarView}
          anchor={calendarAnchor}
          basePath={CLIENT_ROUTES.root}
          title={messages.copy.todayAtAGlance}
          expandHref={CLIENT_ROUTES.calendar}
        />
      </Suspense>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ClientMetricCard label={messages.copy.arrivalsToday} value={arrivingToday.length} href={CLIENT_ROUTES.reservations} />
        <ClientMetricCard label={messages.copy.upcomingStays} value={dashboard.counts.upcomingReservations} href={CLIENT_ROUTES.reservations} />
        <ClientMetricCard label={messages.copy.openIssues} value={dashboard.counts.openIssues} href={CLIENT_ROUTES.issues} />
        <ClientMetricCard label={messages.copy.guests} value={dashboard.counts.guests} href={CLIENT_ROUTES.guests} />
      </section>

      <ClientSectionCard title={attention === 0 ? messages.copy.caughtUp : messages.copy.needsAttention}>
        {attention === 0 ? (
          <p className="text-sm text-onwarda-muted">
            {messages.copy.noTasks}
            {nextArrival ? (
              <>
                {" "}
                {messages.copy.nextUp}{" "}
                <Link
                  href={clientReservationPath(nextArrival.id)}
                  className="font-medium underline underline-offset-4"
                >
                  <bdi>{guestDisplayName(nextArrival.guestName, messages.guestFallback)}</bdi>
                </Link>
                {` · `}
                <bdi>{nextArrival.propertyName ?? messages.copy.aProperty}</bdi>
                {` · ${formatStay(nextArrival.checkIn, nextArrival.checkOut, dates)}.`}
              </>
            ) : null}
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {arrivingToday.map((reservation) => (
              <li key={reservation.id}>
                <Link href={clientReservationPath(reservation.id)} className="font-medium underline underline-offset-4">
                  <bdi>{guestDisplayName(reservation.guestName, messages.guestFallback)}</bdi> {messages.copy.arrivesToday}
                </Link>
                <span className="text-onwarda-muted"> · <bdi>{reservation.propertyName ?? messages.copy.property}</bdi></span>
              </li>
            ))}
            {dashboard.openIssues.slice(0, 3).map((issue) => (
              <li key={issue.id}>
                <Link href={CLIENT_ROUTES.issues} className="font-medium capitalize underline underline-offset-4">
                  {humanizeToken(issue.category)}
                </Link>
                <span className="text-onwarda-muted"> · <bdi>{issue.propertyName ?? messages.copy.workspace}</bdi></span>
              </li>
            ))}
          </ul>
        )}
      </ClientSectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <ClientSectionCard
          title={messages.copy.properties}
          description={messages.copy.homesAndRooms}
          action={
            <Link href={CLIENT_ROUTES.properties} className="text-sm text-onwarda-olive hover:underline">
              {messages.copy.viewAll}
            </Link>
          }
        >
          {dashboard.properties.length === 0 ? (
            <ClientEmptyState
              title={messages.copy.propertiesEmptyTitle}
              description={messages.copy.propertiesEmptyBody}
            />
          ) : (
            <ul className="divide-y">
              {dashboard.properties.map((property) => (
                <li key={property.id}>
                  <Link
                    href={clientPropertyPath(property.id)}
                    className="flex items-center justify-between gap-3 py-3 hover:text-onwarda-olive"
                  >
                    <div>
                      <p className="font-medium">{property.name}</p>
                      <p className="text-sm text-onwarda-muted">
                        <bdi>{propertyLocation(property) ?? messages.copy.locationNotSet}</bdi>
                      </p>
                    </div>
                    <ClientStatusBadge label={labeledStatus(property.status, statusLabels)} tone={statusTone(property.status)} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </ClientSectionCard>

        <ClientSectionCard
          title={messages.copy.upcomingReservations}
          description={messages.copy.arrivalsAhead}
          action={
            <Link href={CLIENT_ROUTES.reservations} className="text-sm text-onwarda-olive hover:underline">
              {messages.copy.viewAll}
            </Link>
          }
        >
          {dashboard.upcomingReservations.length === 0 ? (
            <ClientEmptyState
              title={messages.copy.reservationsEmptyTitle}
              description={messages.copy.reservationsEmptyBody}
            />
          ) : (
            <ul className="divide-y">
              {dashboard.upcomingReservations.map((reservation) => (
                <li key={reservation.id}>
                  <Link
                    href={clientReservationPath(reservation.id)}
                    className="flex flex-col gap-1 py-3 hover:text-onwarda-olive sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium"><bdi>{guestDisplayName(reservation.guestName, messages.guestFallback)}</bdi></p>
                      <p className="text-sm text-onwarda-muted">
                        <bdi>{reservation.propertyName ?? messages.copy.property}</bdi> · {formatStay(reservation.checkIn, reservation.checkOut, dates)}
                      </p>
                    </div>
                    <ClientStatusBadge label={labeledStatus(reservation.status, statusLabels)} tone={statusTone(reservation.status)} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </ClientSectionCard>

        <ClientSectionCard
          title={messages.copy.guests}
          description={messages.copy.guestsBody}
          action={
            <Link href={CLIENT_ROUTES.guests} className="text-sm text-onwarda-olive hover:underline">
              {messages.copy.viewAll}
            </Link>
          }
        >
          {dashboard.guests.length === 0 ? (
            <ClientEmptyState
              title={messages.copy.guestsEmptyTitle}
              description={messages.copy.guestsEmptyBody}
            />
          ) : (
            <ul className="divide-y">
              {dashboard.guests.map((guest) => (
                <li key={guest.id}>
                  <Link
                    href={clientGuestPath(guest.id)}
                    className="flex items-center justify-between gap-3 py-3 hover:text-onwarda-olive"
                  >
                    <div>
                      <p className="font-medium">
                        <bdi>{guestDisplayName({
                          first_name: guest.firstName,
                          last_name: guest.lastName,
                        }, messages.guestFallback)}</bdi>
                      </p>
                      <p className="text-sm text-onwarda-muted" dir="ltr">{guest.email ?? messages.copy.noEmail}</p>
                    </div>
                    <p className="text-sm text-onwarda-muted">{fillMessage(messages.copy.staysCount, { count: guest.stayCount })}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </ClientSectionCard>

        <ClientSectionCard
          title={messages.copy.openIssues}
          description={messages.copy.openIssuesBody}
          action={
            <Link href={CLIENT_ROUTES.issues} className="text-sm text-onwarda-olive hover:underline">
              {messages.copy.viewAll}
            </Link>
          }
        >
          {dashboard.openIssues.length === 0 ? (
            <ClientEmptyState
              title={messages.copy.issuesEmptyTitle}
              description={messages.copy.issuesEmptyBody}
            />
          ) : (
            <ul className="divide-y">
              {dashboard.openIssues.map((issue) => (
                <li key={issue.id}>
                  <Link
                    href={CLIENT_ROUTES.issues}
                    className="flex flex-col gap-1 py-3 hover:text-onwarda-olive sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium capitalize">{humanizeToken(issue.category)}</p>
                      <p className="line-clamp-1 text-sm text-onwarda-muted">
                        <bdi>{issue.propertyName ?? messages.copy.workspace}</bdi> · <bdi>{issue.description}</bdi>
                      </p>
                    </div>
                    <ClientStatusBadge label={issue.priority} tone={statusTone(issue.priority)} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </ClientSectionCard>

        <ClientSectionCard
          title={messages.copy.recentActivity}
          description={messages.copy.recentActivityBody}
        >
          {dashboard.activity.length === 0 ? (
            <ClientEmptyState
              title={messages.screens.quiet}
              description={messages.copy.activityEmptyBody}
            />
          ) : (
            <ul className="divide-y">
              {dashboard.activity.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3 py-3">
                  <p className="text-sm capitalize">{humanizeToken(entry.eventType)}</p>
                  <time className="text-xs text-onwarda-muted" dateTime={entry.createdAt}>
                    {formatDate(entry.createdAt, dates)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </ClientSectionCard>
      </div>
    </div>
  );
}
