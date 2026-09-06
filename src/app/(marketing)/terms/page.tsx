import { marketingMetadata } from "@/lib/marketing/seo";

export const metadata = marketingMetadata({
  title: "Terms",
  description: "Onwarda terms placeholder.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <section className="mx-auto max-w-3xl px-5 py-16">
      <p className="mk-kicker">Legal</p>
      <h1 className="mk-display mt-3">Terms</h1>
      <p className="mk-lede mt-5">
        This page is a placeholder. Commercial terms have not been finalized. Choosing a plan or creating an account
        does not create a paid subscription.
      </p>
    </section>
  );
}
