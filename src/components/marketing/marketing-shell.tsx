import type { ReactNode } from "react";
import Link from "next/link";

import { OnwardaWordmark } from "@/components/brand/onwarda-wordmark";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { MARKETING_NAV, MARKETING_ROUTES } from "@/config/marketing";

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="onwarda-marketing min-h-svh">
      <MarketingNav />
      <main>{children}</main>
      <footer className="border-t border-[var(--mk-line)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-12 md:flex-row md:items-start md:justify-between md:px-8">
          <div>
            <OnwardaWordmark tagline />
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-[var(--mk-muted)]">
            {MARKETING_NAV.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-[var(--mk-ink)]">
                {item.label}
              </Link>
            ))}
            <Link href={MARKETING_ROUTES.contact} className="hover:text-[var(--mk-ink)]">
              Contact
            </Link>
            <Link href={MARKETING_ROUTES.login} className="hover:text-[var(--mk-ink)]">
              Login
            </Link>
            <Link href={MARKETING_ROUTES.privacy} className="hover:text-[var(--mk-ink)]">
              Privacy
            </Link>
            <Link href={MARKETING_ROUTES.terms} className="hover:text-[var(--mk-ink)]">
              Terms
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

export function MarketingSection({
  kicker,
  title,
  children,
  id,
}: {
  kicker?: string;
  title: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="mx-auto max-w-6xl px-5 py-16 md:py-20">
      {kicker ? <p className="mk-kicker">{kicker}</p> : null}
      <h2 className="mt-3 max-w-3xl text-3xl font-medium tracking-tight md:text-4xl">{title}</h2>
      <div className="mt-8">{children}</div>
    </section>
  );
}

export function MarketingCtas() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Link href={MARKETING_ROUTES.signup} className="mk-cta mk-cta-primary">
        Start with Onwarda
      </Link>
      <Link href={`${MARKETING_ROUTES.product}#how-it-works`} className="mk-cta mk-cta-secondary">
        See how it works
      </Link>
    </div>
  );
}
