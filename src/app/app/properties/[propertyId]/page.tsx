import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  ClientEmptyState,
  ClientMetricCard,
  ClientPageHeader,
  ClientSectionCard,
  ClientStatusBadge,
} from "@/components/workspace/client-ui";
import { EditPropertyForm } from "@/components/workspace/property-form";
import {
  CLIENT_ROUTES,
  canManageStays,
  canManageWorkspace,
  clientReservationCreatePath,
  clientReservationPath,
} from "@/config/client";
import { NotFoundError } from "@/lib/errors";
import { requireWorkspaceView } from "@/lib/tenancy/workspace-access";
import { getWorkspaceProperty } from "@/lib/workspace/data";
import {
  formatDate,
  guestDisplayName,
  humanizeToken,
  propertyLocation,
  reservationStatusLabel,
  statusTone,
} from "@/lib/workspace/format";

export const metadata = {
  title: "Property",
};

export default async function ClientPropertyDetailPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  const view = await requireWorkspaceView();

  let property;

  try {
    property = await getWorkspaceProperty(propertyId);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }

    throw error;
  }

  const canEdit =
    view.kind === "membership" && canManageWorkspace(view.context.membership.role);
  const canCreateStay =
    view.kind === "membership" && canManageStays(view.context.membership.role);
  const location = propertyLocation(property);

  return (
    <div className="space-y-6">
      <ClientPageHeader
        kicker="Homes"
        title={property.name}
        description={location ?? "Location not set yet."}
        actions={
          <div className="flex flex-wrap gap-2">
            {canCreateStay ? (
              <Button asChild>
                <Link href={clientReservationCreatePath(property.id)}>
                  Create reservation
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link href={CLIENT_ROUTES.properties}>All properties</Link>
            </Button>
          </div>
        }
      />

      <section aria-label="Property summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ClientMetricCard
          label="Reservations"
          value={property.reservationCount}
          href={CLIENT_ROUTES.reservations}
        />
        <ClientMetricCard label="Guests who stayed" value={property.stayGuestCount} />
        <ClientMetricCard
          label="Open issues"
          value={property.openIssueCount}
          href={CLIENT_ROUTES.issues}
        />
        <ClientMetricCard
          label="Knowledge"
          value={property.knowledgeCount}
          href={CLIENT_ROUTES.knowledge}
        />
      </section>

      <ClientSectionCard title="Property information">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-onwarda-muted">Name</dt>
            <dd className="mt-1 font-medium">{property.name}</dd>
          </div>
          <div>
            <dt className="text-onwarda-muted">Location</dt>
            <dd className="mt-1 font-medium">{location ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-onwarda-muted">Status</dt>
            <dd className="mt-1">
              <ClientStatusBadge label={property.status} tone={statusTone(property.status)} />
            </dd>
          </div>
          <div>
            <dt className="text-onwarda-muted">Created</dt>
            <dd className="mt-1 font-medium">{formatDate(property.createdAt)}</dd>
          </div>
        </dl>
      </ClientSectionCard>

      {canEdit ? (
        <ClientSectionCard
          title="Edit property"
          description="Name, location, and status only. The organization comes from your membership."
        >
          <EditPropertyForm
            propertyId={property.id}
            name={property.name}
            city={property.city}
            country={property.country}
            status={property.status}
          />
        </ClientSectionCard>
      ) : null}

      <ClientSectionCard
        title="Reservations"
        description="Recent and upcoming stays in this home."
        action={
          <Link href={CLIENT_ROUTES.reservations} className="text-sm text-onwarda-olive hover:underline">
            View reservations
          </Link>
        }
      >
        {property.reservations.length === 0 ? (
          <ClientEmptyState
            title="No reservations yet."
            description="When a stay is created for this property, it will appear here."
            action={
              canCreateStay ? (
                <Button asChild>
                  <Link href={clientReservationCreatePath(property.id)}>
                    Create reservation
                  </Link>
                </Button>
              ) : null
            }
          />
        ) : (
          <ul className="divide-y">
            {property.reservations.map((reservation) => (
              <li key={reservation.id}>
                <Link
                  href={clientReservationPath(reservation.id)}
                  className="flex flex-col gap-1 py-3 hover:text-onwarda-olive sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{guestDisplayName(reservation.guestName)}</p>
                    <p className="text-sm text-onwarda-muted">
                      {formatDate(reservation.checkIn)} – {formatDate(reservation.checkOut)}
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

      <div className="grid gap-6 xl:grid-cols-2">
        <ClientSectionCard
          title="Issues"
          description="Open items that belong to this property."
          action={
            <Link href={CLIENT_ROUTES.issues} className="text-sm text-onwarda-olive hover:underline">
              View issues
            </Link>
          }
        >
          {property.issues.length === 0 ? (
            <p className="text-sm text-onwarda-muted">No open issues for this property.</p>
          ) : (
            <ul className="divide-y">
              {property.issues.map((issue) => (
                <li key={issue.id} className="py-3">
                  <p className="font-medium capitalize">{humanizeToken(issue.category)}</p>
                  <p className="line-clamp-2 text-sm text-onwarda-muted">{issue.description}</p>
                </li>
              ))}
            </ul>
          )}
        </ClientSectionCard>

        <ClientSectionCard
          title="Knowledge"
          description="House notes attached to this property."
          action={
            <Link href={CLIENT_ROUTES.knowledge} className="text-sm text-onwarda-olive hover:underline">
              View knowledge
            </Link>
          }
        >
          {property.knowledge.length === 0 ? (
            <p className="text-sm text-onwarda-muted">No knowledge entries yet.</p>
          ) : (
            <ul className="divide-y">
              {property.knowledge.map((entry) => (
                <li key={entry.id} className="py-3">
                  <p className="font-medium">{entry.title}</p>
                  <p className="text-sm text-onwarda-muted capitalize">
                    {humanizeToken(entry.category)} · {entry.locale}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </ClientSectionCard>
      </div>
    </div>
  );
}
