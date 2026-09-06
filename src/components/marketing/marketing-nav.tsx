import Link from "next/link";

import { OnwardaWordmark } from "@/components/brand/onwarda-wordmark";
import { MarketingMobileNav } from "@/components/marketing/marketing-mobile-nav";
import { MARKETING_NAV, MARKETING_ROUTES } from "@/config/marketing";

export function MarketingNav() {
  return (
    <header className="relative sticky top-0 z-30 border-b border-[var(--mk-line)] bg-[color-mix(in_srgb,var(--mk-cream)_88%,white)] backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
        <Link href={MARKETING_ROUTES.home} className="flex items-center gap-3">
          <OnwardaWordmark className="text-[var(--mk-ink)]" />
          <span className="hidden text-xs tracking-[0.16em] text-[var(--mk-muted)] uppercase sm:block">
            Hospitality
          </span>
        </Link>
        <nav aria-label="Onwarda" className="hidden items-center gap-6 lg:flex">
          {MARKETING_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-[var(--mk-muted)] underline-offset-4 hover:text-[var(--mk-ink)] hover:underline"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-3 lg:flex">
          <Link href={MARKETING_ROUTES.login} className="text-sm font-medium">
            Log in
          </Link>
          <Link href={MARKETING_ROUTES.signup} className="mk-cta mk-cta-primary">
            Get started
          </Link>
        </div>
        <MarketingMobileNav />
      </div>
    </header>
  );
}
