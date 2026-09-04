import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  ClientPageHeader,
  ClientSectionCard,
  ClientStatusBadge,
} from "@/components/workspace/client-ui";
import { ReservationStatusForm } from "@/components/workspace/reservation-status-form";
import {
  CLIENT_ROUTES,
  canManageStays,
  clientGuestPath,
  clientPropertyPath,
} from "@/config/client";
import { NotFoundError } from "@/lib/errors";
import { requireWorkspaceView } from "@/lib/tenancy/workspace-access";
import { getWorkspaceReservation } from "@/lib/workspace/data";
import {
  formatDate,
  guestDisplayName,
  humanizeToken,
  propertyLocation,
  reservationStatusLabel,
  statusTone,
} from "@/lib/workspace/format";

export const metadata = {
  title: "Reservation",
};

function JourneyStep({
  title,
  state,
  detail,
}: {
  title: string;
  state: "complete" | "pending" | "later";
  detail: string;
}) {
  const mark =
    state === "complete" ? "Complete" : state === "pending" ? "Pending" : "Later";

  return (
    <li className="flex items-start justify-between gap-4 py-3">
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-onwarda-muted">{detail}</p>
      </div>
      <ClientStatusBadge
        label={mark}
        tone={state === "complete" ? "olive" : state === "pending" ? "coral" : "neutral"}
      />
    </li>
  );
}

export default async function ClientReservationDetailPage({
  params,
}: {
  params: Promise<{ reservationId: string }>;
}) {
  const { reservationId } = await params;
  const view = await requireWorkspaceView();

  let reservation;

  try {
    reservation = await getWorkspaceReservation(reservationId);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }

    throw error;
  }

  const canUpdate =
    view.kind === "membership" && canManageStays(view.context.membership.role);
  const guestName = guestDisplayName({
    first_name: reservation.guestFirstName,
    last_name: reservation.guestLastName,
  });
  const location = propertyLocation({
    city: reservation.propertyCity,
    country: reservation.propertyCountry,
  });
  const guestReady = Boolean(reservation.guestFirstName && reservation.guestLastName);
  const arrivalReady =
    reservation.status === "active" || reservation.status === "completed";

  return (
    <div className="space-y-6">
      <ClientPageHeader
        kicker="Stays"
        title={guestName}
        description={`${reservation.propertyName} · ${formatDate(reservation.checkIn)} – ${formatDate(reservation.checkOut)}`}
        actions={
          <Button asChild variant="outline">
            <Link href={CLIENT_ROUTES.reservations}>All reservations</Link>
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <ClientSectionCard title="Reservation">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-onwarda-muted">Status</dt>
              <dd className="mt-1">
                <ClientStatusBadge
                  label={reservationStatusLabel(reservation.status)}
                  tone={statusTone(reservation.status)}
                />
              </dd>
            </div>
            <div>
              <dt className="text-onwarda-muted">Reference</dt>
              <dd className="mt-1 font-medium">{reservation.reference}</dd>
            </div>
            <div>
              <dt className="text-onwarda-muted">Arrival</dt>
              <dd className="mt-1 font-medium">{formatDate(reservation.checkIn)}</dd>
            </div>
            <div>
              <dt className="text-onwarda-muted">Departure</dt>
              <dd className="mt-1 font-medium">{formatDate(reservation.checkOut)}</dd>
            </div>
            <div>
              <dt className="text-onwarda-muted">Created</dt>
              <dd className="mt-1 font-medium">{formatDate(reservation.createdAt)}</dd>
            </div>
          </dl>
          {canUpdate ? (
            <div className="mt-5 border-t pt-5">
              <ReservationStatusForm
                reservationId={reservation.id}
                status={reservation.status}
              />
            </div>
          ) : null}
        </ClientSectionCard>

        <ClientSectionCard title="Property">
          <p className="font-medium">{reservation.propertyName}</p>
          <p className="mt-1 text-sm text-onwarda-muted">{location ?? "Location not set"}</p>
          <div className="mt-4">
            <Button asChild variant="outline">
              <Link href={clientPropertyPath(reservation.propertyId)}>View property</Link>
            </Button>
          </div>
        </ClientSectionCard>
      </div>

      <ClientSectionCard title="Guest">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-onwarda-muted">Name</dt>
            <dd className="mt-1 font-medium">{guestName}</dd>
          </div>
          <div>
            <dt className="text-onwarda-muted">Email</dt>
            <dd className="mt-1 font-medium">{reservation.guestEmail ?? "—"}</dd>
          </div>
        </dl>
        <div className="mt-4">
          <Button asChild variant="outline">
            <Link href={clientGuestPath(reservation.guestId)}>View guest</Link>
          </Button>
        </div>
      </ClientSectionCard>

      <ClientSectionCard
        title="Guest journey"
        description="The guest portal is not generated in this phase."
      >
        <ul className="divide-y">
          <JourneyStep
            title="Reservation"
            state="complete"
            detail="This stay has been created in the workspace."
          />
          <JourneyStep
            title="Guest information"
            state={guestReady ? "complete" : "pending"}
            detail={
              reservation.guestEmail
                ? "Name and contact are on file."
                : "Name is on file. Email can be added later."
            }
          />
          <JourneyStep
            title="Arrival information"
            state={arrivalReady ? "complete" : "pending"}
            detail={
              arrivalReady
                ? "The stay has reached in-stay or completed."
                : "Arrival details stay pending until the stay begins."
            }
          />
          <JourneyStep
            title="Guest Portal"
            state="later"
            detail="Not generated yet. Guest-facing access comes in a later phase."
          />
        </ul>
      </ClientSectionCard>

      {reservation.issues.length > 0 ? (
        <ClientSectionCard title="Issues" description="Items linked to this reservation.">
          <ul className="divide-y">
            {reservation.issues.map((issue) => (
              <li key={issue.id} className="py-3">
                <p className="font-medium capitalize">{humanizeToken(issue.category)}</p>
                <p className="text-sm text-onwarda-muted">{issue.description}</p>
              </li>
            ))}
          </ul>
        </ClientSectionCard>
      ) : null}
    </div>
  );
}
