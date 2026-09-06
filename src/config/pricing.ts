import { ORGANIZATION_PLANS, type OrganizationPlan } from "@/types/enums";

export const PRICING_CURRENCY = "MAD" as const;
export const PRICING_INTERVAL = "month" as const;

export const PRICING_DISCLAIMER =
  "These are indicative monthly prices to help you compare. Final commercial terms are confirmed during onboarding. Payment setup is not available yet.";

export type CommercialPlanStatus = "published" | "hidden";
export type CommercialPlanCta = "signup" | "contact";

export type CommercialPlan = {
  id: OrganizationPlan;
  name: string;
  description: string;
  basePrice: number;
  currency: typeof PRICING_CURRENCY;
  billingInterval: typeof PRICING_INTERVAL;
  propertyAllowance: { min: number; max: number | null };
  perPropertyPrice: number | null;
  features: string[];
  cta: { label: string; href: string; kind: CommercialPlanCta };
  displayOrder: number;
  status: CommercialPlanStatus;
  highlighted?: boolean;
};

export const COMMERCIAL_PLANS: readonly CommercialPlan[] = [
  {
    id: ORGANIZATION_PLANS.STARTER,
    name: "Starter",
    description: "The Onwarda core for a small portfolio.",
    basePrice: 299,
    currency: PRICING_CURRENCY,
    billingInterval: PRICING_INTERVAL,
    propertyAllowance: { min: 1, max: 3 },
    perPropertyPrice: null,
    features: [
      "Digital property portfolio",
      "Guest portal and guided stay journey",
      "Property knowledge and self-service answers",
      "Operational workspace for stays and issues",
      "Operator branding on guest and public pages",
    ],
    cta: { label: "Start with Starter", href: "/signup?plan=starter", kind: "signup" },
    displayOrder: 1,
    status: "published",
  },
  {
    id: ORGANIZATION_PLANS.PROFESSIONAL,
    name: "Pro",
    description: "For growing operators who need more homes in one layer.",
    basePrice: 699,
    currency: PRICING_CURRENCY,
    billingInterval: PRICING_INTERVAL,
    propertyAllowance: { min: 4, max: 15 },
    perPropertyPrice: 39,
    features: [
      "Everything in Starter",
      "Larger property allowance",
      "Per-property expansion as the portfolio grows",
      "Shared operational visibility across homes",
      "Priority onboarding support",
    ],
    cta: { label: "Start with Pro", href: "/signup?plan=professional", kind: "signup" },
    displayOrder: 2,
    status: "published",
    highlighted: true,
  },
  {
    id: ORGANIZATION_PLANS.ENTERPRISE,
    name: "Agency",
    description: "For conciergeries and multi-portfolio operators.",
    basePrice: 1290,
    currency: PRICING_CURRENCY,
    billingInterval: PRICING_INTERVAL,
    propertyAllowance: { min: 15, max: null },
    perPropertyPrice: 29,
    features: [
      "Everything in Pro",
      "Portfolio-scale property allowance",
      "Lower per-property expansion",
      "Assisted onboarding with Onwarda",
      "Room for future automation as it ships",
    ],
    cta: { label: "Talk to Onwarda", href: "/contact?intent=demo&plan=enterprise", kind: "contact" },
    displayOrder: 3,
    status: "published",
  },
] as const;

export function listPublishedCommercialPlans() {
  return COMMERCIAL_PLANS.filter((plan) => plan.status === "published").sort(
    (left, right) => left.displayOrder - right.displayOrder,
  );
}

export function getCommercialPlan(id: string | null | undefined) {
  if (!id) {
    return null;
  }

  return COMMERCIAL_PLANS.find((plan) => plan.id === id) ?? null;
}

export function isSelectableCommercialPlan(id: string | null | undefined): id is OrganizationPlan {
  const plan = getCommercialPlan(id);
  return Boolean(plan && plan.status === "published");
}

export function formatPlanPrice(plan: CommercialPlan) {
  const base = `${plan.basePrice.toLocaleString("en-US")} ${plan.currency}/${plan.billingInterval}`;

  if (plan.perPropertyPrice) {
    return `${base} + ${plan.perPropertyPrice} ${plan.currency} / active property`;
  }

  return base;
}

export function formatPropertyAllowance(plan: CommercialPlan) {
  if (plan.propertyAllowance.max === null) {
    return `${plan.propertyAllowance.min}+ properties`;
  }

  if (plan.propertyAllowance.min === plan.propertyAllowance.max) {
    return `${plan.propertyAllowance.max} properties`;
  }

  return `${plan.propertyAllowance.min}–${plan.propertyAllowance.max} properties`;
}
