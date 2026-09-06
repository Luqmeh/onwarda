import { describe, expect, it } from "vitest";

import {
  COMMERCIAL_PLANS,
  getCommercialPlan,
  isSelectableCommercialPlan,
  listPublishedCommercialPlans,
} from "@/config/pricing";
import { commercialSignupSchema } from "@/lib/validation/commercial";

describe("commercial pricing configuration", () => {
  it("keeps published plans in one config object", () => {
    const published = listPublishedCommercialPlans();

    expect(published.map((plan) => plan.id)).toEqual(["starter", "professional", "enterprise"]);
    expect(published.every((plan) => plan.currency === "MAD")).toBe(true);
    expect(getCommercialPlan("starter")?.basePrice).toBe(299);
    expect(getCommercialPlan("free")).toBeNull();
  });

  it("does not treat hidden or unknown plans as selectable", () => {
    expect(isSelectableCommercialPlan("starter")).toBe(true);
    expect(isSelectableCommercialPlan("agency")).toBe(false);
    expect(isSelectableCommercialPlan("free")).toBe(false);
    expect(isSelectableCommercialPlan("active")).toBe(false);
  });

  it("rejects signup with an unknown plan or invalid credentials", () => {
    expect(
      commercialSignupSchema.safeParse({
        email: "not-an-email",
        password: "password1",
        fullName: "Ayoub",
        organizationName: "Riad Atlas",
        plan: "starter",
      }).success,
    ).toBe(false);

    expect(
      commercialSignupSchema.safeParse({
        email: "host@example.com",
        password: "short",
        fullName: "Ayoub",
        organizationName: "Riad Atlas",
        plan: "starter",
      }).success,
    ).toBe(false);

    expect(
      commercialSignupSchema.safeParse({
        email: "host@example.com",
        password: "password1",
        fullName: "Ayoub",
        organizationName: "",
        plan: "starter",
      }).success,
    ).toBe(false);

    expect(
      commercialSignupSchema.safeParse({
        email: "host@example.com",
        password: "password1",
        fullName: "Ayoub",
        organizationName: "Riad Atlas",
        plan: "unknown-plan",
      }).success,
    ).toBe(false);

    expect(
      commercialSignupSchema.safeParse({
        email: "host@example.com",
        password: "password1",
        fullName: "Ayoub",
        organizationName: "Riad Atlas",
        plan: "starter",
      }).success,
    ).toBe(true);
  });

  it("does not encode internal financial model language", () => {
    const serialized = JSON.stringify(COMMERCIAL_PLANS);

    expect(serialized).not.toMatch(/COGS|gross-margin|CAC|LTV|supplier economics/i);
  });
});
