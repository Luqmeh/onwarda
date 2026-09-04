import { describe, expect, it } from "vitest";

import {
  provisionOrganizationSchema,
  sanitizeOrganizationSearch,
  suggestOrganizationSlug,
} from "@/lib/validation/organization";

describe("organization provisioning validation", () => {
  it("normalizes a name into a slug candidate", () => {
    expect(suggestOrganizationSlug("Riad Atlas")).toBe("riad-atlas");
    expect(suggestOrganizationSlug("  Hôtel  Médina  ")).toBe("hotel-medina");
  });

  it("requires name, slug, and owner email", () => {
    const parsed = provisionOrganizationSchema.safeParse({
      name: "Riad Atlas",
      slug: "riad-new",
      ownerEmail: "Owner@Example.com",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.status).toBe("active");
      expect(parsed.data.ownerEmail).toBe("owner@example.com");
    }
  });

  it("rejects reserved slugs and invalid emails", () => {
    expect(
      provisionOrganizationSchema.safeParse({
        name: "Admin Co",
        slug: "admin",
        ownerEmail: "owner@example.com",
      }).success,
    ).toBe(false);
    expect(
      provisionOrganizationSchema.safeParse({
        name: "Riad Atlas",
        slug: "riad-new",
        ownerEmail: "not-an-email",
      }).success,
    ).toBe(false);
  });

  it("strips filter metacharacters from search input", () => {
    expect(sanitizeOrganizationSearch("riad%,()atlas")).toBe("riadatlas");
  });
});
