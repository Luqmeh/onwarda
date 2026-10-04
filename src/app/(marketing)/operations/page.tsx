import Link from "next/link";

import { MarketingSection } from "@/components/marketing/marketing-shell";
import { MARKETING_ROUTES } from "@/config/marketing";
import { recordMarketingEvent } from "@/lib/marketing/events";
import { marketingMetadata } from "@/lib/marketing/seo";

export const metadata = marketingMetadata({
  title: "Operations",
  description: "Onwarda gives independent hosts, property managers, and conciergeries one operating layer.",
  path: "/operations",
});

export default async function OperationsPage() {
  await recordMarketingEvent({ type: "marketing_page_viewed", path: "/operations" });

  return (
    <>
      <section className="mx-auto max-w-6xl px-5 pt-16">
        <p className="mk-kicker">Solutions</p>
        <h1 className="mk-display mt-3">Use Onwarda alongside the systems you already rely on.</h1>
        <p className="mk-lede mt-5 max-w-2xl">
          Independent hosts, property managers, conciergeries, and small hospitality operators get visibility into
          properties, reservations, guests, arrivals, departures, onboarding, issues, and knowledge — without replacing
          a PMS or OTA.
        </p>
      </section>
      <MarketingSection kicker="Visibility" title="Instead of searching messages and spreadsheets.">
        <div className="grid gap-4 md:grid-cols-3">
          {["Properties", "Reservations", "Guests", "Arrivals", "Onboarding", "Issues"].map((item) => (
            <article key={item} className="mk-card p-5">
              <h2 className="font-medium">{item}</h2>
            </article>
          ))}
        </div>
        <p className="mk-lede mt-8">
          Integrations with Airbnb, Booking.com, or a PMS are not part of this product yet. Onwarda is the operating
          layer around the stay you already have.
        </p>
        <Link href={MARKETING_ROUTES.signup} className="mk-cta mk-cta-primary mt-8">
          Start with Onwarda
        </Link>
      </MarketingSection>
    </>
  );
}
