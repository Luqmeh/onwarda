import { describe, expect, it } from "vitest";

import { organizationSlugSchema } from "@/lib/validation/organization";

describe("organization slug validation", () => {
  it("accepts a clean lowercase slug", () => {
    expect(organizationSlugSchema.parse("riad-atlas")).toBe("riad-atlas");
  });

  it("rejects reserved application routes", () => {
    expect(organizationSlugSchema.safeParse("admin").success).toBe(false);
    expect(organizationSlugSchema.safeParse("app").success).toBe(false);
    expect(organizationSlugSchema.safeParse("g").success).toBe(false);
  });

  it("rejects uppercase and unsafe characters", () => {
    expect(organizationSlugSchema.safeParse("Riad Atlas").success).toBe(false);
    expect(organizationSlugSchema.safeParse("riad_atlas").success).toBe(false);
  });
});
