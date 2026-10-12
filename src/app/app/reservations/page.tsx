import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  ClientEmptyState,
  ClientPageHeader,
  ClientSectionCard,
  ClientStatusBadge,
} from "@/components/workspace/client-ui";
import { CLIENT_ROUTES, canManageStays, clientReservationPath } from "@/config/client";
import { getRequestI18n } from "@/i18n/get-locale";
import { clientMetadata } from "@/i18n/page-title";
import { formattingLocale } from "@/i18n/locale";
import { requireWorkspaceView } from "@/lib/tenancy/workspace-access";
import { listWorkspaceReservations } from "@/lib/workspace/data";
import {
  formatDate,
  guestDisplayName,
  labeledStatus,
  statusTone,
} from "@/lib/workspace/format";

export async function generateMetadata() {
  return clientMetadata((messages) => ({ title: messages.titles.reservations }));
}

export default async function ClientReservationsPage() {
  const [{ locale, messages }, view, reservations] = await Promise.all([
    getRequestI18n(),
    requireWorkspaceView(),
    listWorkspaceReservations(),
  ]);
  const dates = formattingLocale(locale);
  const canAdd =
    view.kind === "membership" && canManageStays(view.context.membership.role);

  return (
    <div className="space-y-6">
      <ClientPageHeader
        kicker={messages.copy.staysKicker}
        title={messages.nav.reservations}
        description={messages.copy.reservationsDescription}
        actions={
          canAdd ? (
            <Button asChild>
              <Link href={CLIENT_ROUTES.reservationNew}>{messages.copy.newReservation}</Link>
            </Button>
          ) : null
        }
      />

      {reservations.length === 0 ? (
        <ClientSectionCard title={messages.copy.staysKicker}>
          <ClientEmptyState
            title={messages.copy.staysEmptyTitle}
            description={messages.copy.staysEmptyBody}
            action={
              canAdd ? (
                <Button asChild>
                  <Link href={CLIENT_ROUTES.reservationNew}>{messages.copy.newReservation}</Link>
                </Button>
              ) : null
            }
          />
        </ClientSectionCard>
      ) : (
        <div className="space-y-6">
          {Array.from(
            reservations.reduce((groups, reservation) => {
              const key = reservation.checkIn.slice(0, 10);
              const current = groups.get(key) ?? [];
              current.push(reservation);
              groups.set(key, current);
              return groups;
            }, new Map<string, typeof reservations>()),
          ).map(([day, stays]) => (
            <section key={day}>
              <h2 className="mb-3 text-sm font-medium text-onwarda-muted">
                {formatDate(day, dates)}
              </h2>
              <ul className="space-y-3">
                {stays.map((reservation) => (
                  <li key={reservation.id}>
                    <Link
                      href={clientReservationPath(reservation.id)}
                      className="client-surface client-lift flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium"><bdi>{guestDisplayName(reservation.guestName, messages.guestFallback)}</bdi></p>
                        <p className="text-sm text-onwarda-muted">
                          <bdi>{reservation.propertyName ?? messages.copy.property}</bdi> · {formatDate(reservation.checkIn, dates)} –{" "}
                          {formatDate(reservation.checkOut, dates)}
                        </p>
                      </div>
                      <ClientStatusBadge
                        label={labeledStatus(reservation.status, messages.status)}
                        tone={statusTone(reservation.status)}
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
