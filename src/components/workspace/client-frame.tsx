"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, MoreHorizontal, X } from "lucide-react";

import { ClientNav, type ClientNavLink } from "@/components/workspace/client-nav";
import { ClientUserMenu } from "@/components/workspace/client-user-menu";
import { Button } from "@/components/ui/button";
import { CLIENT_ROUTES, isClientNavActive } from "@/config/client";

const DOCK = [
  CLIENT_ROUTES.root,
  CLIENT_ROUTES.calendar,
  CLIENT_ROUTES.properties,
  CLIENT_ROUTES.cleaning,
] as const;

type ClientFrameProps = {
  items: ClientNavLink[];
  email: string;
  name: string | null;
  organizationName: string;
  role: string;
  canManageSettings: boolean;
  brand: ReactNode;
  footer: ReactNode;
  children: ReactNode;
};

export function ClientFrame({
  items,
  email,
  name,
  organizationName,
  role,
  canManageSettings,
  brand,
  footer,
  children,
}: ClientFrameProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const dock = DOCK.map((href) => items.find((item) => item.href === href)).filter(
    (item): item is ClientNavLink => Boolean(item),
  );

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-[1600px]">
      <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-e border-onwarda-olive/10 bg-onwarda-white/70 px-4 py-6 lg:flex">
        <div className="px-2">{brand}</div>
        <div className="mt-8 flex-1 overflow-y-auto">
          <ClientNav items={items} />
        </div>
        <div className="px-2 pt-6">{footer}</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 bg-[color-mix(in_srgb,var(--client-background)_88%,transparent)] px-4 backdrop-blur-sm lg:px-8">
          <div className="flex min-w-0 items-center gap-3 lg:hidden">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-11"
              aria-expanded={open}
              aria-controls="client-mobile-nav"
              onClick={() => setOpen((value) => !value)}
            >
              {open ? <X className="size-4" /> : <Menu className="size-4" />}
              <span className="sr-only">{open ? "Close navigation" : "Open navigation"}</span>
            </Button>
            <div className="min-w-0">{brand}</div>
          </div>
          <p className="hidden text-sm text-onwarda-muted lg:block">{organizationName}</p>
          <ClientUserMenu
            email={email}
            name={name}
            organizationName={organizationName}
            role={role}
            canManageSettings={canManageSettings}
          />
        </header>
        {open ? (
          <div id="client-mobile-nav" className="border-b bg-onwarda-white px-4 py-4 lg:hidden">
            <ClientNav items={items} onNavigate={() => setOpen(false)} />
          </div>
        ) : null}
        <main className="min-w-0 flex-1 px-4 pt-2 pb-24 lg:px-8 lg:pt-4 lg:pb-10">{children}</main>
        <nav
          aria-label="Primary"
          className="fixed inset-x-0 bottom-0 z-30 border-t bg-onwarda-white/95 px-2 py-2 backdrop-blur-sm lg:hidden"
        >
          <ul className="mx-auto grid max-w-lg grid-cols-5 gap-1">
            {dock.map((item) => {
              const active = isClientNavActive(pathname, item.href, item.exact);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-11 items-center justify-center rounded-xl px-1 text-center text-[0.68rem] font-medium ${
                      active
                        ? "bg-[color-mix(in_srgb,var(--client-primary)_12%,white)] text-onwarda-charcoal"
                        : "text-onwarda-muted"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
            <li>
              <button
                type="button"
                className="flex min-h-11 w-full flex-col items-center justify-center rounded-xl text-[0.68rem] font-medium text-onwarda-muted"
                onClick={() => setOpen(true)}
              >
                <MoreHorizontal className="size-4" aria-hidden="true" />
                More
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}
