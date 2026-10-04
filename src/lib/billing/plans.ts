import {
  getCommercialPlan,
  isSelectableCommercialPlan,
  PRICING_CURRENCY,
  PRICING_INTERVAL,
} from "@/config/pricing";
import { ValidationError } from "@/lib/errors";
import type { PlanPriceProjection } from "@/lib/billing/types";
import type { OrganizationPlan } from "@/types/enums";

export function assertSelectableCommercialPlan(planId: string): asserts planId is OrganizationPlan {
  if (!isSelectableCommercialPlan(planId)) {
    throw new ValidationError("Choose a published Onwarda plan.");
  }
}

export function calculatePlanPrice(input: {
  planId: string;
  activePropertyCount: number;
}): PlanPriceProjection {
  if (!Number.isInteger(input.activePropertyCount) || input.activePropertyCount < 0) {
    throw new ValidationError("Active property count must be a non-negative integer.");
  }

  const plan = getCommercialPlan(input.planId);

  if (!plan || plan.status !== "published") {
    throw new ValidationError("Choose a published Onwarda plan.");
  }

  const variableAmount = plan.perPropertyPrice
    ? plan.perPropertyPrice * input.activePropertyCount
    : 0;

  return {
    planId: plan.id,
    currency: PRICING_CURRENCY,
    billingInterval: PRICING_INTERVAL,
    baseAmount: plan.basePrice,
    perPropertyAmount: plan.perPropertyPrice,
    activePropertyCount: input.activePropertyCount,
    variableAmount,
    indicativeTotal: plan.basePrice + variableAmount,
    indicative: true,
  };
}

export function formatIndicativePrice(projection: PlanPriceProjection) {
  const total = `${projection.indicativeTotal.toLocaleString("en-US")} ${projection.currency}/${projection.billingInterval}`;

  if (!projection.perPropertyAmount) {
    return `${total} (indicative)`;
  }

  return `${total} (indicative · ${projection.baseAmount} base + ${projection.perPropertyAmount} × ${projection.activePropertyCount} active ${projection.activePropertyCount === 1 ? "property" : "properties"})`;
}
