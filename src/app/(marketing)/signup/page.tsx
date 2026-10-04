import Link from "next/link";

import { PersistSelectedPlan } from "@/components/marketing/persist-selected-plan";
import { CommercialSignupForm } from "@/components/marketing/signup-form";
import { getCommercialPlan } from "@/config/pricing";
import { MARKETING_ROUTES } from "@/config/marketing";
import { getCurrentUser } from "@/lib/auth/session";
import { readSelectedPlanHint } from "@/lib/commercial/actions";
import { recordMarketingEvent } from "@/lib/marketing/events";
import { marketingMetadata } from "@/lib/marketing/seo";
import { getCurrentOrganization } from "@/lib/tenancy/context";

export const metadata = marketingMetadata({
  title: "Get started",
  description: "Create an Onwarda account and select a plan. Payment setup comes next.",
  path: "/signup",
});

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const params = await searchParams;
  const selectedPlan = (await readSelectedPlanHint(params.plan)) ?? "starter";
  const plan = getCommercialPlan(selectedPlan);
  const user = await getCurrentUser();
  const membership = user ? await getCurrentOrganization().catch(() => null) : null;

  await recordMarketingEvent({ type: "signup_started", path: "/signup", plan: selectedPlan });

  return (
    <section className="mx-auto max-w-xl px-5 py-16">
      <PersistSelectedPlan plan={selectedPlan} />
      <p className="mk-kicker">Get started</p>
      <h1 className="mk-display mt-3">Start with the core.</h1>
      <p className="mk-lede mt-5">
        {plan ? `${plan.name} is selected.` : "Choose a published plan."} Creating an account sets up your
        organization and records a pending plan. Payment setup is coming next.
      </p>
      {membership ? (
        <div className="mk-card mt-8 p-6">
          <p className="text-sm leading-relaxed">
            You are already signed in to {membership.organization.name}. A new organization is not created for an
            existing workspace. Your selected plan is stored only if the subscription is still pending.
          </p>
          <div className="mt-5">
            <CommercialSignupForm selectedPlan={selectedPlan} existingAccount />
          </div>
        </div>
      ) : (
        <div className="mk-card mt-8 p-6">
          <CommercialSignupForm selectedPlan={selectedPlan} existingAccount={Boolean(user)} />
        </div>
      )}
      <p className="mt-6 text-sm text-[var(--mk-muted)]">
        Already have an account?{" "}
        <Link
          href={`${MARKETING_ROUTES.login}?next=${encodeURIComponent(`/signup?plan=${selectedPlan}`)}`}
          className="underline underline-offset-4"
        >
          Log in
        </Link>
      </p>
    </section>
  );
}
