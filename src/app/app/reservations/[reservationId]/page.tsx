import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  ClientPageHeader,
  ClientSectionCard,
  ClientStatusBadge,
} from "@/components/workspace/client-ui";
import { GuestPortalForm } from "@/components/workspace/guest-portal-form";
import { ReservationStatusForm } from "@/components/workspace/reservation-status-form";
import { getReservationCleaningStatus } from "@/lib/cleaning/load";
import {
  CLEANING_TASK_STATUS_LABELS,
  PROPERTY_READINESS_LABELS,
  type CleaningTaskStatus,
  type PropertyReadiness,
} from "@/lib/cleaning/catalog";
import { CLIENT_ROUTES, canManageStays, cleaningTaskPath, clientGuestPath, clientPropertyPath } from "@/config/client";
import { NotFoundError } from "@/lib/errors";
import { requireWorkspaceView } from "@/lib/tenancy/workspace-access";
import { getWorkspaceReservation } from "@/lib/workspace/data";
import { JOURNEY_STATUS_LABELS } from "@/lib/guest-portal/journey";
import {
  formatDate,
  guestDisplayName,
  humanizeToken,
  propertyLocation,
  reservationStatusLabel,
  statusTone,
} from "@/lib/workspace/format";
import type { ReservationJourneyStatus } from "@/types/enums";

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
  const cleaning = reservation.checkoutCompletedAt
    ? await getReservationCleaningStatus(reservation.id)
    : null;

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
          {cleaning ? (
            <div className="mt-5 border-t pt-5 text-sm">
              <p className="font-medium">
                Checked out ·{" "}
                {PROPERTY_READINESS_LABELS[cleaning.readiness as PropertyReadiness] ??
                  CLEANING_TASK_STATUS_LABELS[cleaning.status as CleaningTaskStatus]}
              </p>
              <Link href={cleaningTaskPath(cleaning.id)} className="mt-2 inline-block font-medium underline underline-offset-4">
                View cleaning task
              </Link>
            </div>
          ) : null}
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
        description={
          JOURNEY_STATUS_LABELS[
            (reservation.journeyStatus ?? "not_started") as ReservationJourneyStatus
          ]
        }
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
            title="Onboarding"
            state={reservation.onboardingCompletedAt ? "complete" : "pending"}
            detail={
              reservation.onboardingCompletedAt
                ? "The guest has submitted arrival information."
                : "Waiting for the guest to complete onboarding."
            }
          />
          <JourneyStep
            title="House rules"
            state={reservation.rulesAcceptedAt ? "complete" : "pending"}
            detail={
              reservation.rulesAcceptedAt
                ? "The guest accepted the current house rules."
                : "Rules have not been accepted yet."
            }
          />
          <JourneyStep
            title="Checkout"
            state={reservation.checkoutCompletedAt || arrivalReady ? (reservation.checkoutCompletedAt ? "complete" : "pending") : "later"}
            detail={
              reservation.checkoutCompletedAt
                ? "The guest marked checkout complete."
                : "Checkout is recorded from the guest portal."
            }
          />
        </ul>
        {canUpdate ? (
          <div className="mt-5 border-t pt-5">
            <GuestPortalForm
              reservationId={reservation.id}
              hasActiveLink={reservation.guestPortal.hasActiveLink}
              expiresAt={reservation.guestPortal.expiresAt}
            />
          </div>
        ) : (
          <p className="mt-5 text-sm text-onwarda-muted">
            {reservation.guestPortal.hasActiveLink
              ? "A guest stay link is active."
              : "A guest stay link has not been generated."}
          </p>
        )}
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
