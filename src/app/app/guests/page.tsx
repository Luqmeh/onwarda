import Link from "next/link";

import {
  ClientEmptyState,
  ClientPageHeader,
  ClientSectionCard,
} from "@/components/workspace/client-ui";
import { clientGuestPath } from "@/config/client";
import { listWorkspaceGuests } from "@/lib/workspace/data";
import { formatStay, guestDisplayName } from "@/lib/workspace/format";

export const metadata = {
  title: "Guests",
};

export default async function ClientGuestsPage() {
  const guests = await listWorkspaceGuests();

  return (
    <div className="space-y-6">
      <ClientPageHeader
        kicker="People"
        title="Guests"
        description="A simple directory of guests who have stayed, or will stay, with this organization."
      />

      {guests.length === 0 ? (
        <ClientSectionCard title="Guests">
          <ClientEmptyState
            title="Guests will appear here."
            description="Names stay with this organization. The directory fills in as stays are added."
          />
        </ClientSectionCard>
      ) : (
        <ul className="grid gap-3">
          {guests.map((guest) => {
            const name = guestDisplayName({
              first_name: guest.firstName,
              last_name: guest.lastName,
            });
            return (
              <li key={guest.id}>
                <Link
                  href={clientGuestPath(guest.id)}
                  className="client-surface client-lift flex items-center gap-4 p-4"
                >
                  <span className="flex size-11 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--client-primary)_12%,var(--client-background))] text-sm font-medium">
                    {name.slice(0, 1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{name}</span>
                    <span className="block truncate text-sm text-onwarda-muted">{guest.email ?? "No email on file"}</span>
                  </span>
                  <span className="text-right text-sm text-onwarda-muted">
                    {guest.stayCount} stays
                    <span className="mt-1 block">
                      {guest.latestReservation
                        ? formatStay(guest.latestReservation.checkIn, guest.latestReservation.checkOut)
                        : "No stay yet"}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
