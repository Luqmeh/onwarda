import { CommercialContactForm } from "@/components/marketing/contact-form";
import { onwardaContactEmail, onwardaWhatsappUrl } from "@/config/contact";
import { getCommercialPlan } from "@/config/pricing";
import { recordMarketingEvent } from "@/lib/marketing/events";
import { marketingMetadata } from "@/lib/marketing/seo";

export const metadata = marketingMetadata({
  title: "Contact",
  description: "Talk to Onwarda about the core platform, optional services, or a conversation.",
  path: "/contact",
});

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string; plan?: string }>;
}) {
  const params = await searchParams;
  const kind = params.intent === "demo" ? "demo" : "contact";
  const selectedPlan = getCommercialPlan(params.plan)?.id ?? null;
  const email = onwardaContactEmail();
  const whatsapp = onwardaWhatsappUrl();

  await recordMarketingEvent({ type: "marketing_page_viewed", path: "/contact", plan: selectedPlan });

  return (
    <section className="mx-auto max-w-3xl px-5 py-16">
      <p className="mk-kicker">Contact</p>
      <h1 className="mk-display mt-3">{kind === "demo" ? "Request a conversation" : "Talk to Onwarda"}</h1>
      <p className="mk-lede mt-5">
        Early onboarding is often assisted. Tell us about the portfolio and we will follow up. This is not a payment
        form.
      </p>
      {(email || whatsapp) && (
        <p className="mt-4 text-sm text-[var(--mk-muted)]">
          {email ? (
            <a href={`mailto:${email}`} className="underline underline-offset-4">
              {email}
            </a>
          ) : null}
          {email && whatsapp ? " · " : null}
          {whatsapp ? (
            <a href={whatsapp} className="underline underline-offset-4">
              WhatsApp
            </a>
          ) : null}
        </p>
      )}
      <div className="mk-card mt-8 p-6">
        <CommercialContactForm kind={kind} selectedPlan={selectedPlan} />
      </div>
    </section>
  );
}
