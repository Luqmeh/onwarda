import { recordMarketingEvent } from "@/lib/marketing/events";
import { marketingMetadata } from "@/lib/marketing/seo";

export const metadata = marketingMetadata({
  title: "FAQ",
  description: "Answers about Onwarda, the guest portal, pricing, and how it sits beside existing systems.",
  path: "/faq",
});

const FAQS = [
  ["What is Onwarda?", "An operating layer for hospitality: property presentation, a guided guest stay, and operator visibility."],
  ["Who is it for?", "Independent hosts, property managers, conciergeries, and small hospitality operators."],
  ["Is Onwarda a PMS?", "No. Use it alongside the systems you already rely on."],
  ["Does Onwarda replace Airbnb or Booking.com?", "No. Those remain booking channels. Onwarda is the stay and operations layer."],
  ["What does the guest see?", "A branded, mobile-first portal for their reservation — welcome through checkout."],
  ["Do guests need an account?", "No. They open a secure reservation link."],
  ["Can I use Onwarda with my existing systems?", "Yes as a complementary layer. Direct PMS and OTA integrations are not implemented yet."],
  ["What happens when I add more properties?", "Plans are designed around portfolio size. Indicative pricing is on the pricing page."],
  ["What are optional services?", "Produced work such as 360°, video, smart-access installation, and tutorials."],
  ["Is 360° included?", "Not in the core software. It is an optional property service."],
  ["Can Onwarda help with smart locks?", "As an optional installation service. There is no live lock API in the product today."],
  ["How does the guest portal work?", "A cryptographically random stay link opens only that reservation’s guest-safe content."],
  ["Can I customize my branding?", "Yes. Operator branding appears on public pages and the guest portal."],
  ["Can I cancel?", "Cancellation terms are not finalized yet. Talk to Onwarda and we will be explicit before any paid period starts."],
  ["How does pricing work?", "Indicative monthly plans by portfolio size. Choosing a plan does not charge you."],
] as const;

export default async function FaqPage() {
  await recordMarketingEvent({ type: "marketing_page_viewed", path: "/faq" });

  return (
    <section className="mx-auto max-w-3xl px-5 py-16">
      <p className="mk-kicker">FAQ</p>
      <h1 className="mk-display mt-3">Straightforward answers.</h1>
      <dl className="mt-10 space-y-6">
        {FAQS.map(([question, answer]) => (
          <div key={question}>
            <dt className="font-medium">{question}</dt>
            <dd className="mt-2 text-sm leading-relaxed text-[var(--mk-muted)]">{answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
