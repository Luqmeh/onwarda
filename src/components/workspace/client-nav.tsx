"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Building2,
  CalendarRange,
  CircleAlert,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react";

import { isClientNavActive, type ClientNavItem } from "@/config/client";
import { cn } from "@/lib/utils";

const ICONS = {
  Overview: LayoutDashboard,
  Properties: Building2,
  Reservations: CalendarRange,
  Guests: Users,
  Issues: CircleAlert,
  Knowledge: BookOpen,
  Settings: Settings,
} as const;

type ClientNavProps = {
  items: ClientNavItem[];
  onNavigate?: () => void;
};

export function ClientNav({ items, onNavigate }: ClientNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Workspace" className="flex flex-col gap-1">
      {items.map((item) => {
        const Icon = ICONS[item.label];
        const active = isClientNavActive(pathname, item.href, item.exact);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-onwarda-olive/10 text-onwarda-olive"
                : "text-onwarda-muted hover:bg-onwarda-cream hover:text-onwarda-charcoal",
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
