import { marketingMetadata } from "@/lib/marketing/seo";

export const metadata = marketingMetadata({
  title: "Privacy",
  description: "Onwarda privacy policy placeholder.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <section className="mx-auto max-w-3xl px-5 py-16">
      <p className="mk-kicker">Legal</p>
      <h1 className="mk-display mt-3">Privacy</h1>
      <p className="mk-lede mt-5">
        This page is a placeholder. A complete privacy policy has not been published yet. Do not treat this page as a
        legal document.
      </p>
    </section>
  );
}
