import type { ReactNode } from "react";
import Link from "next/link";

import { OnwardaWordmark } from "@/components/brand/onwarda-wordmark";
import { OrganizationLogo } from "@/components/brand/organization-logo";
import { publicOperatorPath } from "@/config/app";
import {
  organizationBrandStyle,
  type ResolvedOrganizationBranding,
} from "@/lib/branding/resolve";

export function PublicShell({
  branding,
  organizationSlug,
  children,
}: {
  branding: ResolvedOrganizationBranding;
  organizationSlug: string;
  children: ReactNode;
}) {
  return (
    <div className="onwarda-client min-h-svh" style={organizationBrandStyle(branding)}>
      <header className="border-b bg-onwarda-white/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href={publicOperatorPath(organizationSlug)}
            className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--client-primary)]"
          >
            <OrganizationLogo name={branding.displayName} url={branding.logoUrl} size="sm" />
            <span className="truncate text-base font-medium tracking-tight">
              {branding.displayName}
            </span>
          </Link>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t bg-onwarda-white/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-onwarda-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>A stay hosted by {branding.displayName}.</p>
          <OnwardaWordmark size="sm" className="text-onwarda-muted" />
        </div>
      </footer>
    </div>
  );
}

export function PublicUnavailable({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="onwarda-client flex min-h-svh items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="onwarda-kicker">Stay</p>
        <h1 className="onwarda-display mt-3">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-onwarda-muted">{description}</p>
      </div>
    </div>
  );
}
