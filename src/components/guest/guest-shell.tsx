import type { ReactNode } from "react";

import { OrganizationLogo } from "@/components/brand/organization-logo";
import { GuestBottomNav } from "@/components/guest/guest-nav";
import { OnwardaWordmark } from "@/components/brand/onwarda-wordmark";
import { organizationBrandStyle } from "@/lib/branding/resolve";
import type { GuestStay } from "@/lib/guest-portal/load";
import type { GuestTokenStatus } from "@/lib/guest-portal/resolve";

export function GuestUnavailable({ status }: { status: Exclude<GuestTokenStatus, "valid"> }) {
  const copy = {
    invalid: {
      title: "This guest link is not valid",
      description: "Ask your host for a new stay link. Guest links never include reservation or guest identifiers.",
    },
    expired: {
      title: "This guest link has expired",
      description: "Ask your host to send a new stay link if you still need access.",
    },
    revoked: {
      title: "This guest link is no longer active",
      description: "The host has closed this stay link. Request a new one if you still need it.",
    },
    unavailable: {
      title: "This stay is not available",
      description: "The reservation connected to this link is no longer available.",
    },
  }[status];

  return (
    <div className="onwarda-client flex min-h-svh items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="onwarda-kicker">Guest stay</p>
        <h1 className="onwarda-display mt-3">{copy.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-onwarda-muted">{copy.description}</p>
      </div>
    </div>
  );
}

export function GuestShell({
  stay,
  children,
}: {
  stay: GuestStay;
  children: ReactNode;
}) {
  return (
    <div className="onwarda-client min-h-svh pb-28" style={organizationBrandStyle(stay.branding)}>
      <header className="sticky top-0 z-20 border-b bg-onwarda-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-lg items-center gap-3 px-4">
          <OrganizationLogo name={stay.branding.displayName} url={stay.branding.logoUrl} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{stay.content.name}</p>
            <p className="truncate text-xs text-onwarda-muted">{stay.branding.displayName}</p>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-lg px-4 py-6 pb-10">{children}</main>
      <GuestBottomNav token={stay.token} />
      <footer className="mx-auto max-w-lg px-4 pb-8 pt-2 text-center">
        <p className="text-[0.65rem] uppercase tracking-[0.16em] text-onwarda-muted/80">Prepared with</p>
        <OnwardaWordmark size="sm" className="mt-1 text-onwarda-muted/70" />
      </footer>
    </div>
  );
}
