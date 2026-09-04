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

      <ClientSectionCard title="Stay list">
        {reservations.length === 0 ? (
          <ClientEmptyState
            title="Your upcoming reservations will appear here."
            description="When a stay is booked, the guest, home, and dates will live on this page."
            action={
              canAdd ? (
                <Button asChild>
                  <Link href={CLIENT_ROUTES.reservationNew}>New reservation</Link>
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-onwarda-muted">
                <tr>
                  <th className="py-2 font-medium">Guest</th>
                  <th className="py-2 font-medium">Property</th>
                  <th className="py-2 font-medium">Arrival</th>
                  <th className="py-2 font-medium">Departure</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((reservation) => (
                  <tr key={reservation.id} className="border-b last:border-0">
                    <td className="py-3 font-medium">
                      <Link
                        href={clientReservationPath(reservation.id)}
                        className="hover:text-onwarda-olive hover:underline"
                      >
                        {guestDisplayName(reservation.guestName)}
                      </Link>
                    </td>
                    <td className="py-3 text-onwarda-muted">
                      {reservation.propertyName ?? "—"}
                    </td>
                    <td className="py-3">{formatDate(reservation.checkIn)}</td>
                    <td className="py-3">{formatDate(reservation.checkOut)}</td>
                    <td className="py-3">
                      <ClientStatusBadge
                        label={reservationStatusLabel(reservation.status)}
                        tone={statusTone(reservation.status)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ClientSectionCard>
    </div>
  );
}
