import type { ReactNode } from "react";
import Link from "next/link";

import { OnwardaWordmark } from "@/components/brand/onwarda-wordmark";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { ONWARDA_TAGLINE } from "@/config/brand";
import {
  MARKETING_FOOTER_COMPANY,
  MARKETING_FOOTER_PRODUCT,
  MARKETING_ROUTES,
} from "@/config/marketing";

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="onwarda-marketing min-h-svh">
      <MarketingNav />
      <main>{children}</main>
      <footer className="mt-20 border-t border-[var(--mk-line)]">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 md:grid-cols-4">
          <div className="md:col-span-2">
            <OnwardaWordmark className="text-[var(--mk-ink)]" />
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-[var(--mk-muted)]">
              {ONWARDA_TAGLINE} One operating layer for hospitality.
            </p>
          </div>
          <div>
            <p className="mk-kicker">Product</p>
            <ul className="mt-3 grid gap-2 text-sm">
              {MARKETING_FOOTER_PRODUCT.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="underline-offset-4 hover:underline">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mk-kicker">Company</p>
            <ul className="mt-3 grid gap-2 text-sm">
              {MARKETING_FOOTER_COMPANY.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="underline-offset-4 hover:underline">
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href={MARKETING_ROUTES.privacy} className="underline-offset-4 hover:underline">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href={MARKETING_ROUTES.terms} className="underline-offset-4 hover:underline">
                  Terms
                </Link>
              </li>
            </ul>
          </div>
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
