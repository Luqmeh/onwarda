import Link from "next/link";

import { HeroCards, JourneyRail, PropertyScene, WorkspacePanels } from "@/components/marketing/home-visuals";
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

const SERVICES = [
  ["360° property experience", "A captured walkthrough, produced as a service."],
  ["Professional property video", "Filmed presentation for the property page."],
  ["Smart access installation", "Hardware and setup. Not a live lock connection."],
  ["Device and property tutorials", "Guides guests can open in the portal."],
] as const;

export default async function MarketingHomePage() {
  await recordMarketingEvent({ type: "marketing_page_viewed", path: "/" });
  const plans = listPublishedCommercialPlans();

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(marketingJsonLd()) }} />

      <section className="home-hero">
        <div className="home-wrap home-hero-grid">
          <div className="home-rise">
            <p className="mk-kicker">Hospitality operating system</p>
            <h1 className="home-display mt-5">
              Every stay.
              <br />
              Thought through.
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-[var(--mk-muted)]">
              Onwarda gives property operators one connected layer for the home, the guest, and the work that keeps a stay running.
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
          <div className="home-hero-visual home-rise">
            <PropertyScene />
            <HeroCards />
          </div>
        </div>
      </section>

      <section className="home-trust">
        <div className="home-wrap">
          <p className="text-2xl font-medium tracking-tight md:text-3xl">One layer for the entire stay.</p>
          <ul className="mt-8 grid gap-6 sm:grid-cols-3">
            {[
              ["Properties", "The home, written once."],
              ["Guests", "A stay they can follow."],
              ["Operations", "The work behind the welcome."],
            ].map(([title, body]) => (
              <li key={title} className="border-t border-[var(--mk-line)] pt-4">
                <p className="font-medium">{title}</p>
                <p className="mt-1 text-sm text-[var(--mk-muted)]">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="how-it-works" className="home-section">
        <div className="home-wrap">
          <h2 className="home-title max-w-xl">Hospitality has too many disconnected moments.</h2>
          <p className="mt-4 max-w-lg text-[var(--mk-muted)]">
            Arrival notes in one thread. The Wi-Fi in another. Cleaning somewhere else. Onwarda holds the stay together.
          </p>
          <ol className="home-flow">
            {["Property information", "Guest arrival", "House rules", "Guides", "Cleaning", "Checkout"].map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </div>
      </section>

      <section className="home-section home-section-paper">
        <div className="home-wrap space-y-16">
          <article className="home-split">
            <div>
              <p className="mk-kicker">The property</p>
              <h2 className="home-title mt-4">Everything your properties need to feel complete.</h2>
              <p className="mt-4 text-[var(--mk-muted)]">
                Description, amenities, house rules, arrival, and guides live on the property. Public pages and the guest portal read the same record.
              </p>
              <Link href={MARKETING_ROUTES.propertyExperience} className="home-text-link">
                Property experience
              </Link>
            </div>
            <ul className="home-detail-list">
              {["Amenities", "House rules", "Arrival", "Wi-Fi", "Local guides"].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article className="home-split home-split-flip">
            <div>
              <p className="mk-kicker">The guest</p>
              <h2 className="home-title mt-4">Give every guest a stay that feels considered.</h2>
              <p className="mt-4 text-[var(--mk-muted)]">
                One portal for onboarding, arrival, rules, guides, support, and checkout. No extra accounts for the guest.
              </p>
              <Link href={MARKETING_ROUTES.guestExperience} className="home-text-link">
                Guest experience
              </Link>
            </div>
            <div className="home-guest-snippet" aria-hidden="true">
              <p className="home-card-kicker">Your stay</p>
              <p className="mt-2 font-medium">Review house rules</p>
              <p className="mt-1 text-sm text-[var(--mk-muted)]">Then arrival, Wi-Fi, and the guides for the house.</p>
            </div>
          </article>
          <article className="home-split">
            <div>
              <p className="mk-kicker">The operation</p>
              <h2 className="home-title mt-4">Keep every stay moving.</h2>
              <p className="mt-4 text-[var(--mk-muted)]">
                Reservations, cleaning, and property readiness sit in the same workspace as the guest-facing content.
              </p>
              <Link href={MARKETING_ROUTES.operations} className="home-text-link">
                Operations
              </Link>
            </div>
            <ul className="home-detail-list">
              {["Reservations", "Cleaning", "Property readiness", "Open issues", "Team visibility"].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="home-section">
        <div className="home-wrap">
          <p className="mk-kicker">Guest journey</p>
          <h2 className="home-title mt-4 max-w-xl">From booking to goodbye, every moment has a place.</h2>
          <div className="mt-10">
            <JourneyRail />
          </div>
        </div>
      </section>

      <section className="home-ops">
        <div className="home-wrap">
          <h2 className="home-title max-w-lg text-[var(--mk-paper)]">Behind every smooth stay is a smoother operation.</h2>
          <p className="mt-4 max-w-lg text-[color-mix(in_srgb,var(--mk-paper)_78%,var(--mk-sage))]">
            Operators see the property, the stay, and the turnover without chasing the same details across separate tools.
          </p>
          <div className="mt-10">
            <WorkspacePanels />
          </div>
        </div>
      </section>

      <section className="home-section home-section-paper">
        <div className="home-wrap">
          <h2 className="home-title max-w-md">The product, as it actually works.</h2>
          <div className="home-showcase">
            {[
              ["Workspace", "Today’s arrivals, cleaning, and what needs attention."],
              ["Property", "The home’s content, media, and guest-facing notes."],
              ["Calendar", "Stays and turnovers on one property timeline."],
              ["Guest portal", "Arrival, rules, guides, support, and checkout."],
            ].map(([title, body]) => (
              <article key={title} className="home-panel">
                <p className="font-medium">{title}</p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--mk-muted)]">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="home-wrap">
          <h2 className="home-title max-w-xl">One layer between the property and the guest.</h2>
          <ul className="mt-10 grid gap-8 md:grid-cols-2">
            {[
              ["Branded", "The guest sees your name and colors, not a generic portal."],
              ["Connected", "What you write for the property is what the guest receives."],
              ["Operational", "Cleaning and readiness follow the stay, not a separate spreadsheet."],
              ["Guest-first", "The journey is short: arrive, settle, ask, leave."],
            ].map(([title, body]) => (
              <li key={title} className="list-none">
                <p className="text-lg font-medium">{title}</p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--mk-muted)]">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="home-section home-section-sage">
        <div className="home-wrap">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <h2 className="home-title">Services, when you want them.</h2>
            <Link href={MARKETING_ROUTES.services} className="home-text-link">
              All services
            </Link>
          </div>
          <ul className="mt-8 divide-y divide-[var(--mk-line)] border-y border-[var(--mk-line)]">
            {SERVICES.map(([title, body]) => (
              <li key={title}>
                <Link href={MARKETING_ROUTES.services} className="flex flex-col gap-1 py-5 sm:flex-row sm:items-baseline sm:justify-between">
                  <span className="font-medium">{title}</span>
                  <span className="text-sm text-[var(--mk-muted)]">{body}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="home-section">
        <div className="home-wrap">
          <h2 className="home-title max-w-lg">Simple pricing. Built to grow with your properties.</h2>
          <ul className="mt-8 grid gap-6 sm:grid-cols-3">
            {plans.map((plan) => (
              <li key={plan.id}>
                <p className="font-medium">{plan.name}</p>
                <p className="mt-1 text-sm text-[var(--mk-muted)]">{formatPlanTeaserPrice(plan)}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-[var(--mk-muted)]">Indicative pricing. The pricing page is the source of detail.</p>
          <Link href={MARKETING_ROUTES.pricing} className="mk-cta mk-cta-primary mt-8">
            Explore pricing
          </Link>
        </div>
      </section>

      <section className="home-close">
        <div className="home-wrap">
          <h2 className="home-display">Make every stay feel effortless.</h2>
          <p className="mt-4 max-w-md text-[var(--mk-muted)]">
            Bring your properties, guests, and operations into one hospitality experience.
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
