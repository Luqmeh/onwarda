"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Building2, LayoutDashboard, Settings } from "lucide-react";

import { ADMIN_NAV_ITEMS, isAdminNavActive } from "@/config/admin";
import { cn } from "@/lib/utils";

const ICONS = {
  Dashboard: LayoutDashboard,
  Clients: Building2,
  Activity: Activity,
  Settings: Settings,
} as const;

type AdminNavProps = {
  onNavigate?: () => void;
};

export function AdminNav({ onNavigate }: AdminNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin" className="flex flex-col gap-1">
      {ADMIN_NAV_ITEMS.map((item) => {
        const Icon = ICONS[item.label];
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
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
