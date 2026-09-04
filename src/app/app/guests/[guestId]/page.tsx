import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  ClientEmptyState,
  ClientPageHeader,
  ClientSectionCard,
  ClientStatusBadge,
} from "@/components/workspace/client-ui";
import { EditGuestForm } from "@/components/workspace/guest-form";
import {
  CLIENT_ROUTES,
  canManageStays,
  clientReservationCreatePath,
  clientReservationPath,
} from "@/config/client";
import { NotFoundError } from "@/lib/errors";
import { requireWorkspaceView } from "@/lib/tenancy/workspace-access";
import { getWorkspaceGuest } from "@/lib/workspace/data";
import {
  formatStay,
  guestDisplayName,
  reservationStatusLabel,
  statusTone,
} from "@/lib/workspace/format";

export const metadata = {
  title: "Guest",
};

export default async function ClientGuestDetailPage({
  params,
}: {
  params: Promise<{ guestId: string }>;
}) {
  const { guestId } = await params;
  const view = await requireWorkspaceView();

  let guest;

  try {
    guest = await getWorkspaceGuest(guestId);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }

    throw error;
  }

  const canEdit =
    view.kind === "membership" && canManageStays(view.context.membership.role);
  const name = guestDisplayName({
    first_name: guest.firstName,
    last_name: guest.lastName,
  });
  const upcoming = guest.reservations.filter(
    (reservation) =>
      reservation.status === "upcoming" || reservation.status === "active",
  );

  return (
    <div className="space-y-6">
      <ClientPageHeader
        kicker="People"
        title={name}
        description="This guest belongs to the current organization only."
        actions={
          <div className="flex flex-wrap gap-2">
            {canEdit ? (
              <Button asChild>
                <Link href={clientReservationCreatePath()}>Create reservation</Link>
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link href={CLIENT_ROUTES.guests}>All guests</Link>
            </Button>
          </div>
        }
      />

      <ClientSectionCard title="Guest">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-onwarda-muted">Name</dt>
            <dd className="mt-1 font-medium">{name}</dd>
          </div>
          <div>
            <dt className="text-onwarda-muted">Email</dt>
            <dd className="mt-1 font-medium">{guest.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-onwarda-muted">Phone</dt>
            <dd className="mt-1 font-medium">{guest.phone ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-onwarda-muted">Reservations</dt>
            <dd className="mt-1 font-medium">{guest.reservationCount}</dd>
          </div>
        </dl>
      </ClientSectionCard>

      {canEdit ? (
        <ClientSectionCard
          title="Edit guest"
          description="Contact details stay inside this organization."
        >
          <EditGuestForm
            guestId={guest.id}
            firstName={guest.firstName}
            lastName={guest.lastName}
            email={guest.email}
            phone={guest.phone}
          />
        </ClientSectionCard>
      ) : null}

      <ClientSectionCard title="Current and upcoming stays">
        {upcoming.length === 0 ? (
          <p className="text-sm text-onwarda-muted">No current or upcoming stays.</p>
        ) : (
          <ul className="divide-y">
            {upcoming.map((reservation) => (
              <li key={reservation.id}>
                <Link
                  href={clientReservationPath(reservation.id)}
                  className="flex flex-col gap-1 py-3 hover:text-onwarda-olive sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{reservation.propertyName}</p>
                    <p className="text-sm text-onwarda-muted">
                      {formatStay(reservation.checkIn, reservation.checkOut)}
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
        )}
      </ClientSectionCard>

      <ClientSectionCard title="Reservation history">
        {guest.reservations.length === 0 ? (
          <ClientEmptyState
            title="No reservations yet."
            description="When this guest has a stay, it will be listed here."
          />
        ) : (
          <ul className="divide-y">
            {guest.reservations.map((reservation) => (
              <li key={reservation.id}>
                <Link
                  href={clientReservationPath(reservation.id)}
                  className="flex flex-col gap-1 py-3 hover:text-onwarda-olive sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{reservation.propertyName}</p>
                    <p className="text-sm text-onwarda-muted">
                      {formatStay(reservation.checkIn, reservation.checkOut)}
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
        )}
      </ClientSectionCard>
    </div>
  );
}
