import Link from "next/link";

import { GuestJourneySteps, ProductFrames } from "@/components/marketing/product-frames";
import { MarketingSection } from "@/components/marketing/marketing-shell";
import { APP_NAME } from "@/config/app";
import { MARKETING_ROUTES } from "@/config/marketing";
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

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(marketingJsonLd()) }} />
      <section className="border-b border-[var(--mk-line)] bg-[var(--mk-ink)] text-[var(--mk-paper)]">
        <div className="mx-auto max-w-6xl px-5 py-20 md:py-28">
          <p className="text-xs tracking-[0.22em] text-[var(--mk-sage)] uppercase">{APP_NAME}</p>
          <h1 className="mk-display mt-4 text-[var(--mk-paper)]">The operating layer for hospitality.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[color-mix(in_srgb,var(--mk-paper)_78%,transparent)]">
            Make every property easier to discover, easier to enter, easier to experience and easier to operate.
            Onwarda connects the property, the operator, and the guest in one digital layer.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href={MARKETING_ROUTES.signup} className="mk-cta mk-cta-coral">
              Start with Onwarda
            </Link>
            <Link href={`${MARKETING_ROUTES.product}#how-it-works`} className="mk-cta border border-white/20">
              See how it works
            </Link>
            <Link href={MARKETING_ROUTES.login} className="mk-cta text-[var(--mk-paper)]">
              Log in
            </Link>
          </div>
        </div>
      </section>

      <MarketingSection kicker="The problem" title="Hospitality work is scattered. Guests feel it.">
        <div className="grid gap-4 md:grid-cols-2">
          <p className="mk-lede">
            Operators often keep property information in documents, answer the same questions on WhatsApp, share
            access instructions by hand, and juggle booking tools that do not talk to the guest experience.
          </p>
          <p className="mk-lede">
            Onwarda does not ask you to replace the systems you already rely on. It creates a connected layer around
            the property and the stay, so guests receive one clear journey and operators keep visibility.
          </p>
        </div>
      </MarketingSection>

      <MarketingSection kicker="The Onwarda model" title="Attract. Onboard. Assist. Operate.">
        <div className="grid gap-4 md:grid-cols-4">
          {[
            ["Attract", "Present your properties professionally."],
            ["Onboard", "Guide guests through a clear digital journey."],
            ["Assist", "Give guests the information they need, when they need it."],
            ["Operate", "Give operators visibility and calm control."],
          ].map(([title, body]) => (
            <article key={title} className="mk-card p-5">
              <h3 className="font-medium">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--mk-muted)]">{body}</p>
            </article>
          ))}
        </div>
        <p className="mk-lede mt-8">
          One platform. Two experiences. Guest experience ↔ Onwarda ↔ Operator experience.
        </p>
      </MarketingSection>

      <MarketingSection id="how-it-works" kicker="The core platform" title="Seven capabilities, one source of property truth.">
        <div className="grid gap-4 md:grid-cols-2">
          {[
            ["Digital property portfolio", "A public home for the operator and each property."],
            ["Property experience", "Amenities, media, rules, and knowledge maintained once."],
            ["Guest portal", "A secure, reservation-specific stay hub. Guests never create an Onwarda account."],
            ["Digital guest journey", "Guided preparation: details, rules, arrival, then stay information."],
            ["Property knowledge", "Answer Wi-Fi, access, and house questions once."],
            ["Operational command center", "Properties, reservations, guests, arrivals, and issues together."],
            ["Guest relationship layer", "A calmer place to understand who is staying and what they need."],
          ].map(([title, body]) => (
            <article key={title} className="mk-card p-5">
              <h3 className="font-medium">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--mk-muted)]">{body}</p>
            </article>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection kicker="Guest experience" title="One mobile stay instead of scattered instructions.">
        <GuestJourneySteps />
        <Link href={MARKETING_ROUTES.guestExperience} className="mk-cta mk-cta-primary mt-8">
          See the guest experience
        </Link>
      </MarketingSection>

      <MarketingSection kicker="Operator experience" title="One place to understand what is happening.">
        <p className="mk-lede max-w-2xl">
          Properties, reservations, guests, arrivals, departures, onboarding, issues, property knowledge, and
          activity — without turning Onwarda into a second PMS.
        </p>
        <ProductFrames />
        <Link href={MARKETING_ROUTES.operations} className="mk-cta mk-cta-primary mt-8">
          Explore the platform
        </Link>
      </MarketingSection>

      <MarketingSection kicker="Property presentation" title="Structure the home once. Reuse it everywhere.">
        <p className="mk-lede max-w-2xl">
          Public pages, amenities, media, location, rules, optional video or 360°, and a direct-booking CTA all come
          from the same Property CMS. The guest portal reads the same source.
        </p>
      </MarketingSection>

      <MarketingSection kicker="Self-service" title="Answer the question once.">
        <p className="mk-lede max-w-2xl">
          Wi-Fi, AC, TV, kitchen, appliances, access, parking, rules, checkout, and local information become guest
          knowledge instead of repeated messages.
        </p>
      </MarketingSection>

      <MarketingSection kicker="Modular" title="Start with the core. Add services when they create value.">
        <div className="grid gap-4 md:grid-cols-3">
          <article className="mk-card p-5">
            <p className="mk-kicker">Available</p>
            <p className="mt-3 text-sm">Property experience, guest portal, journey, knowledge, and workspace.</p>
          </article>
          <article className="mk-card p-5">
            <p className="mk-kicker">Optional services</p>
            <p className="mt-3 text-sm">360°, professional video, smart-access installation, device tutorials.</p>
          </article>
          <article className="mk-card p-5">
            <p className="mk-kicker">Planned</p>
            <p className="mt-3 text-sm">Revenue intelligence, AI reception, guest protection, and service networks.</p>
          </article>
        </div>
      </MarketingSection>

      <section className="border-t border-[var(--mk-line)]">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <p className="mk-kicker">Ready</p>
          <h2 className="mt-3 max-w-3xl text-4xl font-medium tracking-tight">
            Ready to simplify the way you operate?
          </h2>
          <p className="mk-lede mt-4 max-w-2xl">
            Start with the core. Add what you need. Give every guest a better journey.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href={MARKETING_ROUTES.signup} className="mk-cta mk-cta-primary">
              Start with Onwarda
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
