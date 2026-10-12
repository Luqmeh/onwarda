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
import { getRequestI18n } from "@/i18n/get-locale";
import { clientMetadata } from "@/i18n/page-title";
import { formattingLocale } from "@/i18n/locale";
import { requireWorkspaceView } from "@/lib/tenancy/workspace-access";
import { getWorkspaceGuest } from "@/lib/workspace/data";
import {
  formatStay,
  guestDisplayName,
  reservationStatusLabel,
  statusTone,
} from "@/lib/workspace/format";

export async function generateMetadata() {
  return clientMetadata((messages) => ({ title: messages.titles.guest }));
}

export default async function ClientGuestDetailPage({
  params,
}: {
  params: Promise<{ guestId: string }>;
}) {
  const { guestId } = await params;
  const [{ locale, messages }, view] = await Promise.all([
    getRequestI18n(),
    requireWorkspaceView(),
  ]);
  const dates = formattingLocale(locale);

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
        kicker={messages.screens.people}
        title={name}
        description={messages.screens.guestBelongs}
        actions={
          <div className="flex flex-wrap gap-2">
            {canEdit ? (
              <Button asChild>
                <Link href={clientReservationCreatePath()}>{messages.actions.createReservation}</Link>
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link href={CLIENT_ROUTES.guests}>{messages.actions.allGuests}</Link>
            </Button>
          </div>
        }
      />

      <ClientSectionCard title={messages.fields.guest}>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-onwarda-muted">{messages.actions.name}</dt>
            <dd className="mt-1 font-medium">{name}</dd>
          </div>
          <div>
            <dt className="text-onwarda-muted">{messages.auth.email}</dt>
            <dd className="mt-1 font-medium">{guest.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-onwarda-muted">{messages.actions.phone}</dt>
            <dd className="mt-1 font-medium">{guest.phone ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-onwarda-muted">{messages.actions.reservations}</dt>
            <dd className="mt-1 font-medium">{guest.reservationCount}</dd>
          </div>
        </dl>
      </ClientSectionCard>

      {canEdit ? (
        <ClientSectionCard
          title={messages.screens.editGuest}
          description={messages.screens.editGuestHelp}
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

      <ClientSectionCard title={messages.screens.currentStays}>
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
                      {formatStay(reservation.checkIn, reservation.checkOut, dates)}
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

      <ClientSectionCard title={messages.screens.reservationHistory}>
        {guest.reservations.length === 0 ? (
          <ClientEmptyState
            title={messages.screens.noReservationsYet}
            description={messages.screens.guestStaysEmpty}
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
                      {formatStay(reservation.checkIn, reservation.checkOut, dates)}
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
