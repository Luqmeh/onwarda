import Link from "next/link";

import { OnwardaLockup } from "@/components/brand/onwarda-wordmark";
import {
  HomeGuestFrame,
  HomeHeroVisual,
  HomeJourney,
  HomeOperatorFrame,
  HomePropertyFrame,
} from "@/components/marketing/home-visuals";
import { ONWARDA_BRAND_MOTTO } from "@/config/brand";
import { MARKETING_ROUTES } from "@/config/marketing";
import { formatPlanTeaserPrice, listPublishedCommercialPlans } from "@/config/pricing";
import { recordMarketingEvent } from "@/lib/marketing/events";
import { marketingJsonLd, marketingMetadata } from "@/lib/marketing/seo";

export const metadata = marketingMetadata({
  title: "The operating layer for hospitality",
  description:
    "Onwarda connects property presentation, the guest journey, and operator visibility in one digital layer.",
  path: "/",
});

export default async function MarketingHomePage() {
  await recordMarketingEvent({ type: "marketing_page_viewed", path: "/" });
  const plans = listPublishedCommercialPlans();

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(marketingJsonLd()) }} />

      <section className="mk-hero-glow px-5 pt-16 pb-10 md:pt-24 md:pb-14">
        <div className="mx-auto max-w-3xl text-center">
          <OnwardaLockup className="mk-rise" />
          <h1 className="mk-home-display mk-rise mk-rise-delay mt-12">
            The operating layer for hospitality.
          </h1>
          <p className="mk-motto mk-rise mt-6">{ONWARDA_BRAND_MOTTO}</p>
          <p className="mk-lede mk-rise mx-auto mt-6 max-w-xl">
            One place to present your properties, guide every guest and keep your operation moving.
          </p>
          <div className="mk-rise mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link href={MARKETING_ROUTES.signup} className="mk-cta mk-cta-primary">
              Get started
            </Link>
            <Link href="#how-it-works" className="mk-cta mk-cta-secondary">
              See how it works
            </Link>
          </div>
        </div>
        <div className="mx-auto max-w-6xl">
          <HomeHeroVisual />
        </div>
      </section>

      <section className="mk-band mk-band-blush">
        <div className="mk-home-section mx-auto max-w-6xl px-5">
          <p className="mk-kicker">One platform. Three experiences.</p>
          <div className="mt-12 grid gap-12 md:grid-cols-3">
            {[
              ["Property", "Present every property beautifully."],
              ["Guest", "Give every guest a simple digital stay."],
              ["Operator", "Run the operation from one place."],
            ].map(([title, body]) => (
              <div key={title}>
                <h2 className="text-2xl font-medium tracking-tight">{title}</h2>
                <p className="mt-4 text-[var(--mk-muted)] leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mk-home-section mx-auto max-w-6xl px-5">
        <p className="mk-kicker">How it works</p>
        <h2 className="mt-5 max-w-2xl text-3xl font-medium tracking-tight md:text-4xl">
          Property, guest, and operator — connected.
        </h2>
        <div className="mt-14 grid gap-12 md:grid-cols-3">
          <div>
            <p className="text-[0.7rem] tracking-[0.2em] text-[var(--mk-olive)] uppercase">Property</p>
            <p className="mt-4 leading-relaxed text-[var(--mk-muted)]">
              Your property information lives in one structured place.
            </p>
          </div>
          <div>
            <p className="text-[0.7rem] tracking-[0.2em] text-[var(--mk-olive)] uppercase">Guest</p>
            <p className="mt-4 leading-relaxed text-[var(--mk-muted)]">
              Guests receive one simple digital stay experience.
            </p>
          </div>
          <div>
            <p className="text-[0.7rem] tracking-[0.2em] text-[var(--mk-olive)] uppercase">Operator</p>
            <p className="mt-4 leading-relaxed text-[var(--mk-muted)]">
              Your team sees the property, reservations, guests and issues.
            </p>
          </div>
        </div>
      </section>

      <section className="mk-band mk-band-sage">
        <div className="mk-home-section mx-auto max-w-6xl px-5">
          <p className="mk-kicker">Guest journey</p>
          <h2 className="mt-5 max-w-xl text-3xl font-medium tracking-tight md:text-4xl">
            A better stay starts before arrival.
          </h2>
          <div className="mt-12">
            <HomeJourney />
          </div>
          <div className="mx-auto mt-14 max-w-sm">
            <HomeGuestFrame />
          </div>
        </div>
      </section>

      <section className="mk-home-section mx-auto max-w-6xl px-5">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <div>
            <p className="mk-kicker">Property</p>
            <h2 className="mt-5 text-3xl font-medium tracking-tight md:text-4xl">
              One property. One source of truth. Everywhere it matters.
            </h2>
            <p className="mk-lede mt-6">
              Amenities, rules, media, guides, location and a booking CTA are structured once and reused across public
              pages and the guest portal.
            </p>
          </div>
          <HomePropertyFrame />
        </div>
      </section>

      <section className="mk-band mk-band-mist">
        <div className="mk-home-section mx-auto max-w-6xl px-5">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <div>
              <p className="mk-kicker">Operations</p>
              <h2 className="mt-5 text-3xl font-medium tracking-tight md:text-4xl">Stay on top of the operation.</h2>
              <p className="mk-lede mt-6">
                Properties, reservations, guests, issues and knowledge — in one workspace, alongside the systems you
                already rely on.
              </p>
            </div>
            <HomeOperatorFrame />
          </div>
        </div>
      </section>

      <section className="mk-home-section mx-auto max-w-6xl px-5">
        <h2 className="max-w-xl text-3xl font-medium tracking-tight md:text-4xl">
          Hospitality shouldn&apos;t feel fragmented.
        </h2>
        <ul className="mt-10 max-w-md space-y-4 text-[var(--mk-muted)]">
          <li>Too many messages.</li>
          <li>Too many places for information.</li>
          <li>Too many repeated questions.</li>
        </ul>
        <p className="mt-10 max-w-xl text-lg">Onwarda brings the important pieces together.</p>
      </section>

      <section className="mk-band mk-band-blush">
        <div className="mk-home-section mx-auto max-w-6xl px-5">
          <p className="mk-kicker">Ecosystem</p>
          <h2 className="mt-5 max-w-xl text-3xl font-medium tracking-tight md:text-4xl">
            Start with the core. Expand when you need more.
          </h2>
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            <div>
              <p className="text-sm font-medium">Core platform</p>
              <p className="mt-3 text-sm leading-relaxed text-[var(--mk-muted)]">
                Property experience, guest portal, journey, knowledge and workspace.
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Optional services</p>
              <p className="mt-3 text-sm leading-relaxed text-[var(--mk-muted)]">
                360° experiences, property video, and smart-access installation.
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Future capabilities</p>
              <p className="mt-3 text-sm leading-relaxed text-[var(--mk-muted)]">
                Planned: revenue intelligence, AI reception, guest protection.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mk-home-section mx-auto max-w-6xl px-5">
        <p className="mk-kicker">Pricing</p>
        <h2 className="mt-5 text-3xl font-medium tracking-tight md:text-4xl">Start small. Grow with Onwarda.</h2>
        <div className="mt-12 grid gap-10 sm:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan.id}>
              <p className="text-sm font-medium">{plan.name}</p>
              <p className="mt-2 text-[var(--mk-muted)]">{formatPlanTeaserPrice(plan)}*</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm text-[var(--mk-muted)]">*Indicative pricing. See pricing for details.</p>
        <Link href={MARKETING_ROUTES.pricing} className="mk-cta mk-cta-primary mt-10">
          View pricing
        </Link>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-24 md:py-28">
        <h2 className="max-w-xl text-4xl font-medium tracking-tight md:text-5xl">
          Ready to simplify the way you operate?
        </h2>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link href={MARKETING_ROUTES.signup} className="mk-cta mk-cta-primary">
            Get started
          </Link>
          <Link href={MARKETING_ROUTES.contact} className="mk-cta mk-cta-secondary">
            Talk to us
          </Link>
        </div>
      </section>
    </>
  );
}
