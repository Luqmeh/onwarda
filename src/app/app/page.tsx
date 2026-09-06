import Link from "next/link";

import {
  ClientEmptyState,
  ClientMetricCard,
  ClientPageHeader,
  ClientSectionCard,
  ClientStatusBadge,
} from "@/components/workspace/client-ui";
import {
  CLIENT_ROUTES,
  clientGuestPath,
  clientPropertyPath,
  clientReservationPath,
} from "@/config/client";
import { getWorkspaceDashboard } from "@/lib/workspace/data";
import {
  formatDate,
  formatStay,
  guestDisplayName,
  humanizeToken,
  propertyLocation,
  statusTone,
} from "@/lib/workspace/format";

export const metadata = {
  title: "Overview",
};

export default async function ClientOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const query = await searchParams;
  const dashboard = await getWorkspaceDashboard();

  return (
    <div className="space-y-8">
      <ClientPageHeader
        kicker="Workspace"
        title={`Welcome to ${dashboard.organizationName}`}
        description="A calm view of the properties, stays, and guest needs in your care."
      />
      {query.notice === "payment-setup" ? (
        <p className="rounded-[var(--onwarda-radius)] border bg-onwarda-white px-4 py-3 text-sm" role="status">
          Your organization is ready. The selected plan is pending. Payment setup is coming next — nothing has been
          charged.
        </p>
      ) : null}

      <section aria-label="Workspace metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ClientMetricCard
          label="Properties"
          value={dashboard.counts.properties}
          href={CLIENT_ROUTES.properties}
        />
        <ClientMetricCard
          label="Upcoming stays"
          value={dashboard.counts.upcomingReservations}
          href={CLIENT_ROUTES.reservations}
        />
        <ClientMetricCard
          label="Guests"
          value={dashboard.counts.guests}
          href={CLIENT_ROUTES.guests}
        />
        <ClientMetricCard
          label="Open issues"
          value={dashboard.counts.openIssues}
          href={CLIENT_ROUTES.issues}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <ClientSectionCard
          title="Properties"
          description="Homes and rooms in this organization."
          action={
            <Link href={CLIENT_ROUTES.properties} className="text-sm text-onwarda-olive hover:underline">
              View all
            </Link>
          }
        >
          {dashboard.properties.length === 0 ? (
            <ClientEmptyState
              title="Your properties will appear here."
              description="When you add a home, it becomes the place guests arrive, rest, and leave a little lighter."
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
                        {propertyLocation(property) ?? "Location not set"}
                      </p>
                    </div>
                    <ClientStatusBadge label={property.status} tone={statusTone(property.status)} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </ClientSectionCard>

        <ClientSectionCard
          title="Upcoming reservations"
          description="Arrivals still ahead."
          action={
            <Link href={CLIENT_ROUTES.reservations} className="text-sm text-onwarda-olive hover:underline">
              View all
            </Link>
          }
        >
          {dashboard.upcomingReservations.length === 0 ? (
            <ClientEmptyState
              title="Your upcoming reservations will appear here."
              description="Quiet for now — new stays will land here as soon as they are added."
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
                      <p className="font-medium">{guestDisplayName(reservation.guestName)}</p>
                      <p className="text-sm text-onwarda-muted">
                        {reservation.propertyName ?? "Property"} · {formatStay(reservation.checkIn, reservation.checkOut)}
                      </p>
                    </div>
                    <ClientStatusBadge label={reservation.status} tone={statusTone(reservation.status)} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </ClientSectionCard>

        <ClientSectionCard
          title="Guests"
          description="People staying with this organization."
          action={
            <Link href={CLIENT_ROUTES.guests} className="text-sm text-onwarda-olive hover:underline">
              View all
            </Link>
          }
        >
          {dashboard.guests.length === 0 ? (
            <ClientEmptyState
              title="Guests will appear here."
              description="Names stay with this organization only."
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
                        {guestDisplayName({
                          first_name: guest.firstName,
                          last_name: guest.lastName,
                        })}
                      </p>
                      <p className="text-sm text-onwarda-muted">{guest.email ?? "No email on file"}</p>
                    </div>
                    <p className="text-sm text-onwarda-muted">{guest.stayCount} stays</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </ClientSectionCard>

        <ClientSectionCard
          title="Open issues"
          description="Operational items that still need attention."
          action={
            <Link href={CLIENT_ROUTES.issues} className="text-sm text-onwarda-olive hover:underline">
              View all
            </Link>
          }
        >
          {dashboard.openIssues.length === 0 ? (
            <ClientEmptyState
              title="Everything is quiet."
              description="No open issues in this workspace. That is a good place to be."
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
                        {issue.propertyName ?? "Workspace"} · {issue.description}
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
          title="Recent activity"
          description="What has happened in this organization."
        >
          {dashboard.activity.length === 0 ? (
            <ClientEmptyState
              title="Everything is quiet."
              description="Activity from stays, access, and guest moments will gather here."
            />
          ) : (
            <ul className="divide-y">
              {dashboard.activity.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3 py-3">
                  <p className="text-sm capitalize">{humanizeToken(entry.eventType)}</p>
                  <time className="text-xs text-onwarda-muted" dateTime={entry.createdAt}>
                    {formatDate(entry.createdAt)}
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
