import Link from "next/link";

import { MARKETING_ROUTES } from "@/config/marketing";
import { recordMarketingEvent } from "@/lib/marketing/events";
import { marketingMetadata } from "@/lib/marketing/seo";

export const metadata = marketingMetadata({
  title: "About",
  description: "Onwarda creates a connected layer around the property and guest journey.",
  path: "/about",
});

export default async function AboutPage() {
  await recordMarketingEvent({ type: "marketing_page_viewed", path: "/about" });

  return (
    <section className="mx-auto max-w-3xl px-5 py-16">
      <p className="mk-kicker">About</p>
      <h1 className="mk-display mt-3">One ecosystem. One operating layer.</h1>
      <p className="mk-lede mt-6">
        Hospitality technology is fragmented. Operators should not have to force guests and staff through disconnected
        tools. Onwarda creates a connected layer around the property and the guest journey.
      </p>
      <p className="mk-lede mt-4">
        The vision is specialized technology where it actually helps — not a claim to replace the entire hospitality
        stack. Attract guests. Guide every stay. Operate efficiently.
      </p>
      <Link href={MARKETING_ROUTES.contact} className="mk-cta mk-cta-primary mt-8">
        Talk to Onwarda
      </Link>
    </section>
  );
}
