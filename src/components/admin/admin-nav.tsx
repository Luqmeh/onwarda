"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Building2, LayoutDashboard, Settings } from "lucide-react";

import { ADMIN_NAV_ITEMS, ADMIN_ROUTES, isAdminNavActive } from "@/config/admin";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const ICONS = {
  [ADMIN_ROUTES.root]: LayoutDashboard,
  [ADMIN_ROUTES.clients]: Building2,
  [ADMIN_ROUTES.activity]: Activity,
  [ADMIN_ROUTES.settings]: Settings,
} as const;

type AdminNavProps = {
  onNavigate?: () => void;
};

export function AdminNav({ onNavigate }: AdminNavProps) {
  const pathname = usePathname();
  const { messages } = useI18n();
  const labels = {
    [ADMIN_ROUTES.root]: messages.nav.dashboard,
    [ADMIN_ROUTES.clients]: messages.nav.clients,
    [ADMIN_ROUTES.activity]: messages.nav.activity,
    [ADMIN_ROUTES.settings]: messages.nav.settings,
  } as const;

  return (
    <nav aria-label={messages.nav.admin} className="flex flex-col gap-1">
      {ADMIN_NAV_ITEMS.map((item) => {
        const Icon = ICONS[item.href];
        const active = isAdminNavActive(pathname, item.href, item.exact);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {labels[item.href]}
          </Link>
        );
      })}
    </nav>
  );
}
