import Link from "next/link";

import {
  formatPlanPrice,
  formatPropertyAllowance,
  listPublishedCommercialPlans,
  PRICING_DISCLAIMER,
  type CommercialPlan,
} from "@/config/pricing";
import { cn } from "@/lib/utils";

function PlanCta({ plan }: { plan: CommercialPlan }) {
  return (
    <Link
      href={plan.cta.href}
      className={cn("mk-cta w-full", plan.highlighted ? "mk-cta-coral" : "mk-cta-primary")}
    >
      {plan.cta.label}
    </Link>
  );
}

export function PricingCards() {
  const plans = listPublishedCommercialPlans();

  return (
    <div>
      <p className="max-w-2xl text-sm leading-relaxed text-[var(--mk-muted)]">{PRICING_DISCLAIMER}</p>
      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        {plans.map((plan) => (
          <article
            key={plan.id}
            className={cn("mk-card flex flex-col p-6", plan.highlighted && "ring-1 ring-[var(--mk-coral)]")}
          >
            <p className="mk-kicker">{plan.name}</p>
            <p className="mt-3 text-2xl font-medium tracking-tight">{formatPlanPrice(plan)}</p>
            <p className="mt-2 text-sm text-[var(--mk-muted)]">{formatPropertyAllowance(plan)}</p>
            <p className="mt-4 text-sm leading-relaxed text-[var(--mk-muted)]">{plan.description}</p>
            <ul className="mt-5 flex-1 space-y-2 text-sm">
              {plan.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            <div className="mt-6">
              <PlanCta plan={plan} />
            </div>
          </article>
        ))}
      </div>
      <p className="mt-6 text-sm text-[var(--mk-muted)]">
        Essential guest functionality stays in the core. Plans scale with portfolio size and support, not by locking
        Wi-Fi or arrival behind a higher tier.{" "}
        <Link href="/contact" className="underline underline-offset-4">
          Talk to Onwarda
        </Link>
      </p>
    </div>
  );
}
