"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { guestPortalPath } from "@/config/app";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "", label: "Stay" },
  { href: "/arrival", label: "Arrival" },
  { href: "/guides", label: "Guides" },
  { href: "/support", label: "Help" },
  { href: "/checkout", label: "Checkout" },
] as const;

export function GuestBottomNav({ token }: { token: string }) {
  const pathname = usePathname();
  const suffix = pathname.replace(/^\/g\/[^/]+/, "") || "";

  return (
    <nav
      aria-label="Guest stay"
      className="fixed inset-x-0 bottom-0 z-20 border-t bg-onwarda-white/95 backdrop-blur-sm"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5 px-1">
        {NAV.map((item) => {
          const active = item.href === "" ? suffix === "" : suffix === item.href;

          return (
            <li key={item.href || "home"}>
              <Link
                href={guestPortalPath(token, item.href)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 items-center justify-center px-1 text-center text-[0.7rem] font-medium",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--client-primary)]",
                  active ? "text-[var(--client-primary)]" : "text-onwarda-muted",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
