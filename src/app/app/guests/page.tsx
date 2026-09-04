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

      <ClientSectionCard title="Directory">
        {guests.length === 0 ? (
          <ClientEmptyState
            title="Guests will appear here."
            description="Names are kept with this organization only. Phone numbers and other sensitive details stay out of this overview."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-onwarda-muted">
                <tr>
                  <th className="py-2 font-medium">Name</th>
                  <th className="py-2 font-medium">Email</th>
                  <th className="py-2 font-medium">Reservations</th>
                  <th className="py-2 font-medium">Latest stay</th>
                </tr>
              </thead>
              <tbody>
                {guests.map((guest) => (
                  <tr key={guest.id} className="border-b last:border-0">
                    <td className="py-3 font-medium">
                      <Link
                        href={clientGuestPath(guest.id)}
                        className="hover:text-onwarda-olive hover:underline"
                      >
                        {guestDisplayName({
                          first_name: guest.firstName,
                          last_name: guest.lastName,
                        })}
                      </Link>
                    </td>
                    <td className="py-3 text-onwarda-muted">{guest.email ?? "—"}</td>
                    <td className="py-3">{guest.stayCount}</td>
                    <td className="py-3 text-onwarda-muted">
                      {guest.latestReservation
                        ? formatStay(
                            guest.latestReservation.checkIn,
                            guest.latestReservation.checkOut,
                          )
                        : "—"}
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
