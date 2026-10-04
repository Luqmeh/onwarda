import Link from "next/link";

import { OnwardaWordmark } from "@/components/brand/onwarda-wordmark";
import { MarketingMobileNav } from "@/components/marketing/marketing-mobile-nav";
import { MARKETING_NAV, MARKETING_ROUTES } from "@/config/marketing";

export function MarketingNav() {
  return (
    <header className="relative sticky top-0 z-30 h-[4.5rem] border-b border-[var(--mk-line)] bg-[color-mix(in_srgb,var(--mk-cream)_92%,white)]">
      <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center justify-between gap-6 px-5 md:px-8">
        <Link href={MARKETING_ROUTES.home} className="flex items-center">
          <OnwardaWordmark />
        </Link>
        <nav aria-label="Onwarda" className="hidden items-center gap-7 lg:flex">
          {MARKETING_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-[var(--mk-muted)] transition-colors hover:text-[var(--mk-ink)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-5 lg:flex">
          <Link href={MARKETING_ROUTES.login} className="text-sm text-[var(--mk-muted)] hover:text-[var(--mk-ink)]">
            Log in
          </Link>
          <Link href={MARKETING_ROUTES.signup} className="mk-cta mk-cta-primary min-h-10 px-4 text-sm">
            Get started
          </Link>
        </div>
        <div className="flex items-center gap-2 lg:hidden">
          <Link href={MARKETING_ROUTES.signup} className="mk-cta mk-cta-primary min-h-10 px-3 text-sm">
            Get started
          </Link>
          <MarketingMobileNav />
        </div>
      </div>
    </header>
  );
}
