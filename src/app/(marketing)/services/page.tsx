import Link from "next/link";

import { MarketingSection } from "@/components/marketing/marketing-shell";
import { MARKETING_ROUTES } from "@/config/marketing";
import { recordMarketingEvent } from "@/lib/marketing/events";
import { marketingMetadata } from "@/lib/marketing/seo";

export const metadata = marketingMetadata({
  title: "Services",
  description: "Start with the Onwarda core, then add property services when they create value.",
  path: "/services",
});

export default async function ServicesPage() {
  await recordMarketingEvent({ type: "marketing_page_viewed", path: "/services" });

  return (
    <>
      <section className="mx-auto max-w-6xl px-5 pt-16">
        <p className="mk-kicker">Services</p>
        <h1 className="mk-display mt-3">A modular ecosystem, not a locked bundle.</h1>
      </section>
      <MarketingSection kicker="Onwarda core" title="Included in the platform.">
        <p className="mk-lede">
          Property experience, guest portal, guest journey, property knowledge, operational workspace, guest
          management, and basic operational visibility.
        </p>
      </MarketingSection>
      <MarketingSection kicker="Property services" title="Optional work Onwarda can provide.">
        <div className="grid gap-4 md:grid-cols-2">
          {[
            ["360° property experience", "A captured walkthrough produced as a service."],
            ["Professional property video", "Filmed presentation for the property page."],
            ["Smart access installation", "Hardware and setup help. Not a live lock API."],
            ["Device and property tutorials", "Produced guides guests can open in the portal."],
          ].map(([title, body]) => (
            <article key={title} className="mk-card p-5">
              <h2 className="font-medium">{title}</h2>
              <p className="mt-2 text-sm text-[var(--mk-muted)]">{body}</p>
            </article>
          ))}
        </div>
      </MarketingSection>
      <MarketingSection kicker="Coming / planned" title="Future integrations, clearly labeled.">
        <p className="mk-lede">
          Revenue intelligence, AI reception, guest protection, and a cleaning partner network are planned concepts.
          No commercial partnership is implied.
        </p>
        <Link href={MARKETING_ROUTES.contact} className="mk-cta mk-cta-primary mt-8">
          Talk to Onwarda
        </Link>
      </MarketingSection>
    </>
  );
}
