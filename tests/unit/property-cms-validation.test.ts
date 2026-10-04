import { describe, expect, it } from "vitest";

import { isAllowedContentVisibility } from "@/lib/property-cms/catalog";
import {
  createWorkspacePropertySchema,
  updatePropertyContentSchema,
  updateWorkspacePropertyBasicsSchema,
} from "@/lib/validation/property-cms";

describe("property CMS validation", () => {
  it("lets a property be created with only a name", () => {
    const parsed = createWorkspacePropertySchema.safeParse({
      name: "Riad Atlas",
      status: "draft",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty("organizationId");
    }
  });

  it("rejects an unknown property type", () => {
    const parsed = createWorkspacePropertySchema.safeParse({
      name: "Riad Atlas",
      propertyType: "castle",
      status: "active",
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts structured capacity, rooms, and check-in times", () => {
    const parsed = updateWorkspacePropertyBasicsSchema.safeParse({
      name: "Riad Atlas",
      capacity: "6",
      bedrooms: "3",
      bathrooms: "2.5",
      checkInTime: "15:00",
      checkOutTime: "11:00",
      languages: ["en", "fr"],
      status: "active",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.capacity).toBe(6);
      expect(parsed.data.bathrooms).toBe(2.5);
    }
  });

  it("rejects making lockbox instructions public", () => {
    expect(isAllowedContentVisibility("lockbox_instructions", "public")).toBe(false);
    expect(isAllowedContentVisibility("private_notes", "guest")).toBe(false);

    const parsed = updatePropertyContentSchema.safeParse({
      fields: [
        {
          fieldKey: "lockbox_instructions",
          body: "Code 1234",
          visibility: "public",
        },
      ],
    });

    expect(parsed.success).toBe(false);
  });
});
