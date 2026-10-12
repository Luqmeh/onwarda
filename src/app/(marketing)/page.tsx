import Link from "next/link";

import { Seen, TourPreview } from "@/components/marketing/home-motion";
import {
  AccessFilm,
  HeroStack,
  OpsBoard,
  PropertyScene,
  StayLedger,
  WorkspaceBoard,
} from "@/components/marketing/home-visuals";
import { MARKETING_ROUTES } from "@/config/marketing";
import { formatPlanTeaserPrice, listPublishedCommercialPlans } from "@/config/pricing";
import { recordMarketingEvent } from "@/lib/marketing/events";
import { marketingJsonLd, marketingMetadata } from "@/lib/marketing/seo";

export const metadata = marketingMetadata({
  title: "The operating layer for hospitality",
  description:
    "Onwarda is a property management workspace for hospitality: properties, reservations, guests, and the work of each stay in one place.",
  path: "/",
});

export default async function MarketingHomePage() {
  await recordMarketingEvent({ type: "marketing_page_viewed", path: "/" });
  const plans = listPublishedCommercialPlans();

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(marketingJsonLd()) }} />

      <section className="home-hero">
        <div className="home-wrap home-hero-grid">
          <div>
            <p className="mk-kicker">Property management for hospitality</p>
            <h1 className="home-display mt-5">
              Every stay.
              <br />
              One connected system.
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-[var(--mk-muted)]">
              Onwarda keeps the property, the reservation, the guest, and the team’s work on the same stay — instead of scattered across separate tools.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={MARKETING_ROUTES.signup} className="mk-cta mk-cta-primary">
                Get started
              </Link>
              <Link href="#how-it-works" className="mk-cta mk-cta-secondary">
                See how it works
              </Link>
            </div>
          </div>
          <Seen className="home-hero-visual">
            <PropertyScene />
            <HeroStack />
          </Seen>
        </div>
      </section>

      <section id="how-it-works" className="home-chapter home-chapter-ink">
        <div className="home-wrap home-split">
          <div>
            <p className="home-kicker-light">The workspace</p>
            <h2 className="home-title mt-4">See the stay without opening another tool.</h2>
            <p className="mt-5 max-w-md text-[color-mix(in_srgb,var(--mk-paper)_78%,var(--mk-sage))]">
              A property enters Onwarda once. Reservations, guest-facing notes, cleaning, and open issues stay attached to it.
            </p>
            <Link href={MARKETING_ROUTES.product} className="home-text-link home-text-link-light">
              Product
            </Link>
          </div>
          <Seen>
            <WorkspaceBoard />
          </Seen>
        </div>
      </section>

      <section className="home-chapter">
        <div className="home-wrap">
          <p className="mk-kicker">One stay</p>
          <h2 className="home-title mt-4 max-w-xl">From the property record to the people running it.</h2>
          <p className="mt-4 max-w-lg text-[var(--mk-muted)]">
            These are parts of the same stay, not separate products. The sample below is Courtyard House — a demonstration property, not a customer.
          </p>
          <div className="mt-12">
            <StayLedger />
          </div>
          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm">
            <Link href={MARKETING_ROUTES.propertyExperience} className="home-text-link">
              Property experience
            </Link>
            <Link href={MARKETING_ROUTES.guestExperience} className="home-text-link">
              Guest experience
            </Link>
            <Link href={MARKETING_ROUTES.operations} className="home-text-link">
              Operations
            </Link>
          </div>
        </div>
      </section>

      <section className="home-chapter home-chapter-paper">
        <div className="home-wrap home-split">
          <div>
            <p className="mk-kicker">Daily operations</p>
            <h2 className="home-title mt-4">What the team needs in front of them.</h2>
            <p className="mt-4 text-[var(--mk-muted)]">
              Arrivals, in-house stays, checkout, and turnover on the properties you operate. Readiness follows the reservation. It is not a promise about revenue or time saved.
            </p>
          </div>
          <Seen>
            <OpsBoard />
          </Seen>
        </div>
      </section>

      <section className="home-chapter home-tour">
        <div className="home-wrap home-split">
          <div>
            <p className="mk-kicker">Property tour</p>
            <h2 className="home-title mt-4">Let guests feel the space before they arrive.</h2>
            <p className="mt-4 text-[var(--mk-muted)]">
              A 360° walkthrough is an optional capture service. It belongs with the property, beside the notes the guest already opens. This scene is a preview, not a published tour.
            </p>
            <Link href={MARKETING_ROUTES.services} className="home-text-link">
              Services
            </Link>
          </div>
          <TourPreview />
        </div>
      </section>

      <section className="home-chapter">
        <div className="home-wrap">
          <p className="mk-kicker">Arrival</p>
          <h2 className="home-title mt-4 max-w-xl">Access, ready when the guest is.</h2>
          <p className="mt-4 max-w-lg text-[var(--mk-muted)]">
            Arrival instructions can live with the stay and open in the guest portal. Smart-lock hardware is an installation service. There is no live lock connection in the product.
          </p>
          <div className="mt-12">
            <Seen>
              <AccessFilm />
            </Seen>
          </div>
        </div>
      </section>

      <section className="home-chapter home-chapter-paper">
        <div className="home-wrap home-resolve">
          <p className="mk-kicker">Onwarda</p>
          <h2 className="home-display mt-4 max-w-3xl">The property, the stay, and the guest journey in one workspace.</h2>
          <p className="mt-6 max-w-xl text-lg text-[var(--mk-muted)]">
            Operators keep their own name in front of guests. What you write for the property is what the portal shows. Cleaning and open issues stay next to that same stay.
          </p>
        </div>
      </section>

      <section className="home-plans">
        <div className="home-wrap">
          <h2 className="text-lg font-medium">Plans</h2>
          <ul className="mt-4 flex flex-col gap-2 sm:flex-row sm:gap-8">
            {plans.map((plan) => (
              <li key={plan.id} className="text-sm text-[var(--mk-muted)]">
                <span className="font-medium text-[var(--mk-ink)]">{plan.name}</span>
                {" · "}
                {formatPlanTeaserPrice(plan)}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-[var(--mk-muted)]">Indicative pricing. The pricing page is the source of detail.</p>
          <Link href={MARKETING_ROUTES.pricing} className="home-text-link">
            Explore pricing
          </Link>
        </div>
      </section>

      <section className="home-close">
        <div className="home-wrap">
          <h2 className="home-display max-w-3xl">Bring the stay into one place.</h2>
          <p className="mt-5 max-w-md text-[var(--mk-muted)]">
            Start with your properties. Reservations, guests, and operations follow.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href={MARKETING_ROUTES.signup} className="mk-cta mk-cta-primary">
              Get started
            </Link>
            <Link href={MARKETING_ROUTES.contact} className="mk-cta mk-cta-secondary">
              Talk to us
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
