"use client";

import Link from "next/link";
import { useState } from "react";

import { MARKETING_NAV, MARKETING_ROUTES } from "@/config/marketing";

export function MarketingMobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--mk-line)]"
        aria-expanded={open}
        aria-controls="marketing-mobile-nav"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="sr-only">{open ? "Close" : "Menu"}</span>
        <span aria-hidden="true" className="flex h-3 w-4 flex-col justify-between">
          <span className="block h-px bg-[var(--mk-ink)]" />
          <span className="block h-px bg-[var(--mk-ink)]" />
          <span className="block h-px bg-[var(--mk-ink)]" />
        </span>
      </button>
      {open ? (
        <div
          id="marketing-mobile-nav"
          className="absolute inset-x-0 top-full border-b border-[var(--mk-line)] bg-[color-mix(in_srgb,var(--mk-cream)_96%,white)] px-5 py-4"
        >
          <nav aria-label="Onwarda mobile" className="grid gap-1">
            {MARKETING_NAV.map((item) => (
              <Link key={item.href} href={item.href} className="min-h-11 py-2 text-sm" onClick={() => setOpen(false)}>
                {item.label}
              </Link>
            ))}
            <Link href={MARKETING_ROUTES.login} className="min-h-11 py-2 text-sm" onClick={() => setOpen(false)}>
              Log in
            </Link>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
