import type { ReactNode } from "react";
import Link from "next/link";

import { OnwardaWordmark } from "@/components/brand/onwarda-wordmark";
import { OrganizationLogo } from "@/components/brand/organization-logo";
import { ClientFrame } from "@/components/workspace/client-frame";
import type { ClientNavLink } from "@/components/workspace/client-nav";
import { ClientSupportModeBanner } from "@/components/workspace/support-mode-banner";
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
  const visible = isSupport
    ? CLIENT_NAV_ITEMS.map((item) => item)
    : CLIENT_NAV_ITEMS.filter((item) => item.roles.includes(role));
  const navItems: ClientNavLink[] = [
    ...visible.map((item) => ({ href: item.href, label: item.label, exact: item.exact })),
    { href: CLIENT_ROUTES.account, label: "Account", exact: false },
  ];
  const email =
    view.context.user.email ?? view.context.profile?.email ?? "Unknown user";

  return (
    <div className="onwarda-client min-h-svh" style={organizationBrandStyle(branding)}>
      {isSupport ? (
        <ClientSupportModeBanner session={view.context.supportSession} />
      ) : null}
      <ClientFrame
        items={navItems}
        email={email}
        name={view.context.profile?.full_name ?? null}
        organizationName={branding.displayName}
        role={isSupport ? "support" : role}
        canManageSettings={isSupport || canManageWorkspace(role)}
        brand={
          <Link href={CLIENT_ROUTES.root} className="flex min-w-0 items-center gap-3">
            <OrganizationLogo name={branding.displayName} url={branding.logoUrl} size="sm" />
            <span className="min-w-0">
              <p className="truncate text-base font-medium tracking-tight text-onwarda-charcoal">
                {branding.displayName}
              </p>
              <p className="text-[0.68rem] tracking-[0.14em] text-onwarda-muted uppercase">Hospitality</p>
            </span>
          </Link>
        }
        footer={
          <p className="flex items-center gap-2 text-[0.68rem] tracking-[0.14em] text-onwarda-muted uppercase">
            Powered by <OnwardaWordmark size="sm" />
          </p>
        }
      >
        {children}
      </ClientFrame>
    </div>
  );
}
