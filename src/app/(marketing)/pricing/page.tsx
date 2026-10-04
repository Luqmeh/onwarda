import { PricingCards } from "@/components/marketing/pricing-cards";
import { recordMarketingEvent } from "@/lib/marketing/events";
import { marketingMetadata } from "@/lib/marketing/seo";

export const metadata = marketingMetadata({
  title: "Pricing",
  description: "Indicative Onwarda plans for small portfolios, growing operators, and agencies.",
  path: "/pricing",
});

export default async function PricingPage() {
  await recordMarketingEvent({ type: "pricing_viewed", path: "/pricing" });

  return (
    <section className="mx-auto max-w-6xl px-5 py-16">
      <p className="mk-kicker">Pricing</p>
      <h1 className="mk-display mt-3">Simple entry. Expandable value.</h1>
      <p className="mk-lede mt-5 max-w-2xl">
        Start with the core. Add services when they create value. Choosing a plan captures intent — it does not charge
        a card or activate billing.
      </p>
      <div className="mt-10">
        <PricingCards />
      </div>
    </section>
  );
}
