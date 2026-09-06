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
        className="mk-cta mk-cta-secondary min-h-11 px-3"
        aria-expanded={open}
        aria-controls="marketing-mobile-nav"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Close" : "Menu"}
      </button>
      {open ? (
        <div
          id="marketing-mobile-nav"
          className="absolute inset-x-0 top-full border-b border-[var(--mk-line)] bg-[color-mix(in_srgb,var(--mk-cream)_96%,white)] px-5 py-4"
        >
          <nav aria-label="Onwarda mobile" className="grid gap-3">
            {MARKETING_NAV.map((item) => (
              <Link key={item.href} href={item.href} className="min-h-11 py-2 text-sm" onClick={() => setOpen(false)}>
                {item.label}
              </Link>
            ))}
            <Link href={MARKETING_ROUTES.login} className="min-h-11 py-2 text-sm" onClick={() => setOpen(false)}>
              Log in
            </Link>
            <Link href={MARKETING_ROUTES.signup} className="mk-cta mk-cta-primary" onClick={() => setOpen(false)}>
              Get started
            </Link>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
