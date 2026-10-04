"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Building2,
  CalendarDays,
  CalendarRange,
  CircleAlert,
  CreditCard,
  LayoutDashboard,
  ListChecks,
  Settings,
  UserRound,
  Users,
} from "lucide-react";

import { CLIENT_ROUTES, isClientNavActive } from "@/config/client";

export type ClientNavLink = {
  href: string;
  label: string;
  exact: boolean;
};
import { cn } from "@/lib/utils";

const ICONS = {
  Overview: LayoutDashboard,
  Calendar: CalendarDays,
  Properties: Building2,
  Reservations: CalendarRange,
  Guests: Users,
  Issues: CircleAlert,
  Cleaning: ListChecks,
  Knowledge: BookOpen,
  Billing: CreditCard,
  Settings: Settings,
  Account: UserRound,
} as const;

const SECONDARY = new Set<string>([CLIENT_ROUTES.settings, CLIENT_ROUTES.billing, CLIENT_ROUTES.account]);

type ClientNavProps = {
  items: ClientNavLink[];
  onNavigate?: () => void;
};

export function ClientNav({ items, onNavigate }: ClientNavProps) {
  const pathname = usePathname();
  const primary = items.filter((item) => !SECONDARY.has(item.href));
  const secondary = items.filter((item) => SECONDARY.has(item.href));

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Workspace" className="flex flex-col gap-1">
        {primary.map((item) => (
          <ClientNavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
        ))}
      </nav>
      {secondary.length > 0 ? (
        <nav aria-label="Workspace settings" className="flex flex-col gap-1 border-t border-onwarda-olive/10 pt-4">
          {secondary.map((item) => (
            <ClientNavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </nav>
      ) : null}
    </div>
  );
}

function ClientNavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: ClientNavLink;
  pathname: string;
  onNavigate?: () => void;
}) {
  const Icon = ICONS[item.label as keyof typeof ICONS] ?? LayoutDashboard;
  const active = isClientNavActive(pathname, item.href, item.exact);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn("client-nav-link")}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {item.label}
    </Link>
  );
}
