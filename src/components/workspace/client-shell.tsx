import type { ReactNode } from "react";
import Link from "next/link";

import { OnwardaWordmark } from "@/components/brand/onwarda-wordmark";
import { OrganizationLogo } from "@/components/brand/organization-logo";
import { ClientMobileNav } from "@/components/workspace/client-mobile-nav";
import { ClientNav } from "@/components/workspace/client-nav";
import { ClientSupportModeBanner } from "@/components/workspace/support-mode-banner";
import { ClientUserMenu } from "@/components/workspace/client-user-menu";
import { CLIENT_NAV_ITEMS, CLIENT_ROUTES, canManageWorkspace } from "@/config/client";
import {
  organizationBrandStyle,
  type ResolvedOrganizationBranding,
} from "@/lib/branding/resolve";
import type { WorkspaceView } from "@/types/auth";

type ClientShellProps = {
  view: WorkspaceView;
  branding: ResolvedOrganizationBranding;
  children: ReactNode;
};

export function ClientShell({ view, branding, children }: ClientShellProps) {
  const isSupport = view.kind === "support";
  const role = isSupport ? "staff" : view.context.membership.role;
  const navItems = isSupport
    ? CLIENT_NAV_ITEMS.map((item) => item)
    : CLIENT_NAV_ITEMS.filter((item) => item.roles.includes(role));
  const email =
    view.context.user.email ?? view.context.profile?.email ?? "Unknown user";

  return (
    <div className="onwarda-client min-h-svh" style={organizationBrandStyle(branding)}>
      {isSupport ? (
        <ClientSupportModeBanner session={view.context.supportSession} />
      ) : null}
      <header className="sticky top-0 z-30 border-b bg-onwarda-white/90 backdrop-blur-sm">
        <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <ClientMobileNav items={navItems} />
            <Link href={CLIENT_ROUTES.root} className="flex min-w-0 items-center gap-3">
              <OrganizationLogo
                name={branding.displayName}
                url={branding.logoUrl}
                size="sm"
              />
              <span className="min-w-0">
                <p className="truncate text-base font-medium tracking-tight text-onwarda-charcoal">
                  {branding.displayName}
                </p>
                <OnwardaWordmark size="sm" className="block text-onwarda-muted" />
              </span>
            </Link>
          </div>
          <ClientUserMenu
            email={email}
            name={view.context.profile?.full_name ?? null}
            organizationName={branding.displayName}
            role={isSupport ? "support" : role}
            canManageSettings={isSupport || canManageWorkspace(role)}
          />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl">
        <aside className="sticky top-16 hidden h-[calc(100svh-4rem)] w-56 shrink-0 border-e bg-onwarda-white/60 lg:flex lg:flex-col">
          <div className="flex-1 p-4">
            <ClientNav items={navItems} />
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
