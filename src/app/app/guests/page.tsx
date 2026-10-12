import Link from "next/link";

import {
  ClientEmptyState,
  ClientPageHeader,
  ClientSectionCard,
} from "@/components/workspace/client-ui";
import { clientGuestPath } from "@/config/client";
import { getRequestI18n } from "@/i18n/get-locale";
import { clientMetadata } from "@/i18n/page-title";
import { formattingLocale } from "@/i18n/locale";
import { listWorkspaceGuests } from "@/lib/workspace/data";
import { formatStay, guestDisplayName } from "@/lib/workspace/format";

export async function generateMetadata() {
  return clientMetadata((messages) => ({ title: messages.titles.guests }));
}

export default async function ClientGuestsPage() {
  const [{ locale, messages }, guests] = await Promise.all([
    getRequestI18n(),
    listWorkspaceGuests(),
  ]);
  const dates = formattingLocale(locale);

  return (
    <div className="space-y-6">
      <ClientPageHeader
        kicker={messages.screens.people}
        title={messages.copy.guests}
        description={messages.screens.guestsIntro}
      />

      {guests.length === 0 ? (
        <ClientSectionCard title={messages.copy.guests}>
          <ClientEmptyState
            title={messages.copy.guestsEmptyTitle}
            description={messages.screens.guestsListEmpty}
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
                    <span className="block truncate text-sm text-onwarda-muted">{guest.email ?? messages.copy.noEmail}</span>
                  </span>
                  <span className="text-right text-sm text-onwarda-muted">
                    {guest.stayCount} stays
                    <span className="mt-1 block">
                      {guest.latestReservation
                        ? formatStay(guest.latestReservation.checkIn, guest.latestReservation.checkOut, dates)
                        : messages.screens.noStayYet}
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
