import Link from "next/link";

import { MarketingSection } from "@/components/marketing/marketing-shell";
import { MARKETING_ROUTES } from "@/config/marketing";
import { recordMarketingEvent } from "@/lib/marketing/events";
import { marketingMetadata } from "@/lib/marketing/seo";

export const metadata = marketingMetadata({
  title: "Property experience",
  description: "Turn each property into a structured digital experience used by public pages and the guest portal.",
  path: "/property-experience",
});

export default async function PropertyExperiencePage() {
  await recordMarketingEvent({ type: "marketing_page_viewed", path: "/property-experience" });

  return (
    <>
      <section className="mx-auto max-w-6xl px-5 pt-16">
        <p className="mk-kicker">Property experience</p>
        <h1 className="mk-display mt-3">Structure the property once.</h1>
        <p className="mk-lede mt-5 max-w-2xl">
          Public operator profile, property page, media, amenities, and information flow into the guest portal. Optional
          360°, video, and smart access are services you can add — they are not implied as core software.
        </p>
      </section>
      <MarketingSection kicker="Flow" title="From public page to stay hub.">
        <ol className="grid gap-3 md:grid-cols-3">
          {[
            "Public operator profile",
            "Property page",
            "Media and amenities",
            "Property information",
            "Guest portal",
            "Stay knowledge",
          ].map((item) => (
            <li key={item} className="mk-card px-4 py-4 text-sm">
              {item}
            </li>
          ))}
        </ol>
        <Link href={MARKETING_ROUTES.services} className="mk-cta mk-cta-secondary mt-8">
          View optional services
        </Link>
      </MarketingSection>
    </>
  );
}
