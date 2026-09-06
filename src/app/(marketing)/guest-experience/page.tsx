import Link from "next/link";

import { GuestJourneySteps } from "@/components/marketing/product-frames";
import { MarketingSection } from "@/components/marketing/marketing-shell";
import { MARKETING_ROUTES } from "@/config/marketing";
import { recordMarketingEvent } from "@/lib/marketing/events";
import { marketingMetadata } from "@/lib/marketing/seo";

export const metadata = marketingMetadata({
  title: "Guest experience",
  description: "A mobile-first guest portal that guides each stay from welcome to checkout.",
  path: "/guest-experience",
});

export default async function GuestExperiencePage() {
  await recordMarketingEvent({ type: "marketing_page_viewed", path: "/guest-experience" });

  return (
    <>
      <section className="mx-auto max-w-6xl px-5 pt-16">
        <p className="mk-kicker">Guest experience</p>
        <h1 className="mk-display mt-3">Guests should not need to understand your tools.</h1>
        <p className="mk-lede mt-5 max-w-2xl">
          They receive one branded, reservation-specific experience: welcome, check-in details, house rules, arrival,
          access, Wi-Fi, guides, help, and checkout.
        </p>
      </section>
      <MarketingSection kicker="Journey" title="Guided when it matters. Open when they want to browse.">
        <GuestJourneySteps />
        <ul className="mt-8 grid gap-3 text-sm md:grid-cols-2">
          {[
            "Mobile-first stay hub",
            "Secure reservation-specific access",
            "Personalized to the guest and stay",
            "Branded to the operator",
            "Self-service knowledge",
            "A clear next step, not a maze",
          ].map((item) => (
            <li key={item} className="mk-card px-4 py-3">
              {item}
            </li>
          ))}
        </ul>
        <Link href={MARKETING_ROUTES.signup} className="mk-cta mk-cta-primary mt-8">
          Start with Onwarda
        </Link>
      </MarketingSection>
    </>
  );
}
