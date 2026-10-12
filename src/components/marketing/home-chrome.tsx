"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { OnwardaWordmark } from "@/components/brand/onwarda-wordmark";
import { ONWARDA_TAGLINE } from "@/config/brand";
import { MARKETING_ROUTES } from "@/config/marketing";

const LINKS = [
  { href: MARKETING_ROUTES.product, label: "Product" },
  { href: MARKETING_ROUTES.guestExperience, label: "Guest Experience" },
  { href: MARKETING_ROUTES.propertyExperience, label: "Property Experience" },
  { href: MARKETING_ROUTES.operations, label: "Operations" },
  { href: MARKETING_ROUTES.services, label: "Services" },
  { href: MARKETING_ROUTES.pricing, label: "Pricing" },
] as const;

export function HomeNav() {
  const [open, setOpen] = useState(false);
  const [elevated, setElevated] = useState(false);

  useEffect(() => {
    const onScroll = () => setElevated(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`home-nav ${elevated ? "is-elevated" : ""}`}>
      <div className="mx-auto flex h-[4.25rem] max-w-[1200px] items-center justify-between gap-6 px-5 md:px-8">
        <Link href={MARKETING_ROUTES.home} className="shrink-0" onClick={() => setOpen(false)}>
          <OnwardaWordmark size="sm" />
        </Link>
        <nav aria-label="Onwarda" className="hidden items-center gap-5 xl:flex">
          {LINKS.map((item) => (
            <Link key={item.href} href={item.href} className="home-nav-link">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-5 xl:flex">
          <Link href={MARKETING_ROUTES.login} className="home-nav-link">
            Log in
          </Link>
          <Link href={MARKETING_ROUTES.signup} className="mk-cta mk-cta-primary min-h-10 px-4 text-sm">
            Get started
          </Link>
        </div>
        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--mk-line)] xl:hidden"
          aria-expanded={open}
          aria-controls="home-menu"
          onClick={() => setOpen((value) => !value)}
        >
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          <span aria-hidden="true" className="flex h-3 w-4 flex-col justify-between">
            <span className="block h-px bg-[var(--mk-ink)]" />
            <span className="block h-px bg-[var(--mk-ink)]" />
            <span className="block h-px bg-[var(--mk-ink)]" />
          </span>
        </button>
      </div>
      {open ? (
        <nav id="home-menu" aria-label="Onwarda mobile" className="home-menu xl:hidden">
          {LINKS.map((item) => (
            <Link key={item.href} href={item.href} className="home-menu-link" onClick={() => setOpen(false)}>
              {item.label}
            </Link>
          ))}
          <Link href={MARKETING_ROUTES.login} className="home-menu-link" onClick={() => setOpen(false)}>
            Log in
          </Link>
          <Link href={MARKETING_ROUTES.signup} className="mk-cta mk-cta-primary mt-2" onClick={() => setOpen(false)}>
            Get started
          </Link>
        </nav>
      ) : null}
    </header>
  );
}

export function HomeFooter() {
  const columns = [
    {
      title: "Product",
      links: [
        [MARKETING_ROUTES.product, "Product"],
        [MARKETING_ROUTES.guestExperience, "Guest Experience"],
        [MARKETING_ROUTES.propertyExperience, "Property Experience"],
        [MARKETING_ROUTES.operations, "Operations"],
        [MARKETING_ROUTES.services, "Services"],
      ],
    },
    {
      title: "Company",
      links: [
        [MARKETING_ROUTES.about, "About"],
        [MARKETING_ROUTES.contact, "Contact"],
        [MARKETING_ROUTES.faq, "FAQ"],
      ],
    },
    {
      title: "Resources",
      links: [
        [MARKETING_ROUTES.pricing, "Pricing"],
        [MARKETING_ROUTES.privacy, "Privacy"],
        [MARKETING_ROUTES.terms, "Terms"],
      ],
    },
    {
      title: "Account",
      links: [
        [MARKETING_ROUTES.login, "Log in"],
        [MARKETING_ROUTES.signup, "Get started"],
      ],
    },
  ] as const;

  return (
    <footer className="border-t border-[var(--mk-line)] bg-[var(--mk-paper)]">
      <div className="mx-auto grid max-w-[1180px] gap-12 px-5 py-16 md:grid-cols-[1.1fr_2fr] md:px-8 md:py-20">
        <div>
          <p className="text-lg font-medium tracking-tight lowercase">onwarda</p>
          <p className="mt-2 text-[0.68rem] tracking-[0.18em] text-[var(--mk-olive)] uppercase">{ONWARDA_TAGLINE}</p>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <p className="text-xs tracking-[0.14em] text-[var(--mk-muted)] uppercase">{column.title}</p>
              <ul className="mt-3 space-y-2 text-sm">
                {column.links.map(([href, label]) => (
                  <li key={href}>
                    <Link href={href} className="hover:text-[var(--mk-olive)]">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
      <p className="mx-auto max-w-[1180px] px-5 pb-10 text-xs text-[var(--mk-muted)] md:px-8">
        © {new Date().getFullYear()} Onwarda
      </p>
    </footer>
  );
}
