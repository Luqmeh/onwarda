import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  ClientEmptyState,
  ClientPageHeader,
  ClientSectionCard,
  ClientStatusBadge,
} from "@/components/workspace/client-ui";
import { CLIENT_ROUTES, canManageStays, clientReservationPath } from "@/config/client";
import { requireWorkspaceView } from "@/lib/tenancy/workspace-access";
import { listWorkspaceReservations } from "@/lib/workspace/data";
import {
  formatDate,
  guestDisplayName,
  reservationStatusLabel,
  statusTone,
} from "@/lib/workspace/format";

export const metadata = {
  title: "Reservations",
};

export default async function ClientReservationsPage() {
  const [view, reservations] = await Promise.all([
    requireWorkspaceView(),
    listWorkspaceReservations(),
  ]);
  const canAdd =
    view.kind === "membership" && canManageStays(view.context.membership.role);

  return (
    <div className="space-y-6">
      <ClientPageHeader
        kicker="Stays"
        title="Reservations"
        description="Guest arrivals and departures for this organization only."
        actions={
          canAdd ? (
            <Button asChild>
              <Link href={CLIENT_ROUTES.reservationNew}>New reservation</Link>
            </Button>
          ) : null
        }
      />

      {reservations.length === 0 ? (
        <ClientSectionCard title="Stays">
          <ClientEmptyState
            title="Your stays will appear here."
            description="When a reservation is added, the guest, home, and dates will live on this page."
            action={
              canAdd ? (
                <Button asChild>
                  <Link href={CLIENT_ROUTES.reservationNew}>New reservation</Link>
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
              <h2 className="mb-3 text-[0.7rem] font-medium tracking-[0.14em] text-onwarda-muted uppercase">
                {formatDate(day)}
              </h2>
              <ul className="space-y-3">
                {stays.map((reservation) => (
                  <li key={reservation.id}>
                    <Link
                      href={clientReservationPath(reservation.id)}
                      className="client-surface client-lift flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium">{guestDisplayName(reservation.guestName)}</p>
                        <p className="text-sm text-onwarda-muted">
                          {reservation.propertyName ?? "Property"} · {formatDate(reservation.checkIn)} –{" "}
                          {formatDate(reservation.checkOut)}
                        </p>
                      </div>
                      <ClientStatusBadge
                        label={reservationStatusLabel(reservation.status)}
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
