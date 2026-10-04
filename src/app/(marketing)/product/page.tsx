import Link from "next/link";

import { ProductFrames } from "@/components/marketing/product-frames";
import { MarketingSection } from "@/components/marketing/marketing-shell";
import { MARKETING_ROUTES } from "@/config/marketing";
import { recordMarketingEvent } from "@/lib/marketing/events";
import { marketingMetadata } from "@/lib/marketing/seo";

export const metadata = marketingMetadata({
  title: "Product",
  description: "Onwarda connects property content, the guest portal, and the operator workspace in one platform.",
  path: "/product",
});

export default async function ProductPage() {
  await recordMarketingEvent({ type: "marketing_page_viewed", path: "/product" });

  return (
    <>
      <section className="mx-auto max-w-6xl px-5 pt-16">
        <p className="mk-kicker">Product</p>
        <h1 className="mk-display mt-3">Property, guest, and operator — connected.</h1>
        <p className="mk-lede mt-5 max-w-2xl">
          The property is entered once. Guests receive a guided stay. Operators see what is happening. That is the
          Onwarda core.
        </p>
      </section>
      <MarketingSection id="how-it-works" kicker="Property" title="A structured digital home.">
        <p className="mk-lede max-w-2xl">
          Property CMS, public presentation, media, amenities, rules, and knowledge. Internal notes stay internal.
          Public and guest surfaces reuse the same record.
        </p>
      </MarketingSection>
      <MarketingSection kicker="Guest" title="A secure stay hub, not another login.">
        <p className="mk-lede max-w-2xl">
          Opaque reservation links open onboarding, house rules, arrival, access, Wi-Fi, guides, support, and
          checkout. Guests do not create Onwarda accounts.
        </p>
      </MarketingSection>
      <MarketingSection kicker="Operator" title="A command center for the stay.">
        <p className="mk-lede max-w-2xl">
          Reservations, guests, issues, onboarding status, property management, and operational visibility in one
          operator workspace. Use Onwarda alongside the systems you already rely on.
        </p>
        <ProductFrames />
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href={MARKETING_ROUTES.pricing} className="mk-cta mk-cta-primary">
            See pricing
          </Link>
          <Link href={MARKETING_ROUTES.signup} className="mk-cta mk-cta-secondary">
            Start with Onwarda
          </Link>
        </div>
      </MarketingSection>
    </>
  );
}
