import type { ReactNode } from "react";
import Link from "next/link";

import { OnwardaWordmark } from "@/components/brand/onwarda-wordmark";
import { OrganizationLogo } from "@/components/brand/organization-logo";
import { ClientFrame } from "@/components/workspace/client-frame";
import type { ClientNavLink } from "@/components/workspace/client-nav";
import { ClientSupportModeBanner } from "@/components/workspace/support-mode-banner";
import { CLIENT_NAV_ITEMS, CLIENT_ROUTES, canManageWorkspace } from "@/config/client";
import type { MessageCatalog } from "@/i18n/catalog";
import { getTextDirection } from "@/i18n/config";
import { getRequestI18n } from "@/i18n/get-locale";
import { I18nProvider } from "@/i18n/provider";
import {
  organizationBrandStyle,
  type ResolvedOrganizationBranding,
} from "@/lib/branding/resolve";
import { cn } from "@/lib/utils";
import type { WorkspaceView } from "@/types/auth";

function clientNavLabel(href: string, messages: MessageCatalog) {
  switch (href) {
    case CLIENT_ROUTES.root:
      return messages.nav.overview;
    case CLIENT_ROUTES.calendar:
      return messages.nav.calendar;
    case CLIENT_ROUTES.properties:
      return messages.nav.properties;
    case CLIENT_ROUTES.reservations:
      return messages.nav.reservations;
    case CLIENT_ROUTES.guests:
      return messages.nav.guests;
    case CLIENT_ROUTES.issues:
      return messages.nav.issues;
    case CLIENT_ROUTES.cleaning:
      return messages.nav.cleaning;
    case CLIENT_ROUTES.knowledge:
      return messages.nav.knowledge;
    case CLIENT_ROUTES.billing:
      return messages.nav.billing;
    case CLIENT_ROUTES.settings:
      return messages.nav.settings;
    case CLIENT_ROUTES.account:
      return messages.nav.account;
    default:
      return href;
  }
}

type ClientShellProps = {
  view: WorkspaceView;
  branding: ResolvedOrganizationBranding;
  children: ReactNode;
};

export async function ClientShell({ view, branding, children }: ClientShellProps) {
  const { locale, messages } = await getRequestI18n();
  const direction = getTextDirection(locale);
  const isSupport = view.kind === "support";
  const role = isSupport ? "staff" : view.context.membership.role;
  const visible = isSupport
    ? CLIENT_NAV_ITEMS.map((item) => item)
    : CLIENT_NAV_ITEMS.filter((item) => item.roles.includes(role));
  const navItems: ClientNavLink[] = [
    ...visible.map((item) => ({
      href: item.href,
      label: clientNavLabel(item.href, messages),
      exact: item.exact,
    })),
    { href: CLIENT_ROUTES.account, label: messages.nav.account, exact: false },
  ];
  const email =
    view.context.user.email ?? view.context.profile?.email ?? messages.shell.unknownUser;

  return (
    <div
      lang={locale}
      dir={direction}
      className={cn("onwarda-client min-h-svh", direction === "rtl" && "font-arabic")}
      style={organizationBrandStyle(branding)}
    >
      <I18nProvider locale={locale} messages={messages}>
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
              <p className="text-[0.68rem] text-onwarda-muted">{messages.shell.hospitality}</p>
            </span>
          </Link>
        }
        footer={
          <p className="flex items-center gap-2 text-[0.68rem] text-onwarda-muted">
            {messages.shell.poweredBy} <OnwardaWordmark size="sm" />
          </p>
        }
      >
        {children}
      </ClientFrame>
      </I18nProvider>
    </div>
  );
}
