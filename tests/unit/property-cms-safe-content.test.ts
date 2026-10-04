import { describe, expect, it } from "vitest";

import {
  getGuestPropertyContent,
  getPublicPropertyContent,
  publicPropertyContentHasPrivateData,
  type PropertyCmsSnapshot,
} from "@/lib/property-cms/safe-content";

const snapshot: PropertyCmsSnapshot = {
  id: "11111111-1111-4111-8111-111111111111",
  organizationId: "22222222-2222-4222-8222-222222222222",
  name: "Riad Atlas",
  slug: "riad-atlas",
  internalIdentifier: "ATLAS-SECRET",
  propertyType: "riad",
  address: "1 Derb Secret",
  city: "Marrakech",
  country: "Morocco",
  capacity: 6,
  bedrooms: 3,
  bathrooms: 2,
  checkInTime: "15:00",
  checkOutTime: "11:00",
  description: "A quiet riad in the medina.",
  status: "active",
  languages: ["en", "fr"],
  amenities: ["wifi", "pool"],
  houseRules: [
    {
      ruleKey: "smoking",
      state: "not_allowed",
      details: "No smoking indoors.",
      visibility: "public",
      sortOrder: 10,
    },
    {
      ruleKey: "pets",
      state: "not_allowed",
      details: "Staff-only exception list",
      visibility: "private",
      sortOrder: 20,
    },
  ],
  content: [
    {
      fieldKey: "neighborhood",
      body: "In the medina, near Jemaa el-Fnaa.",
      visibility: "public",
    },
    {
      fieldKey: "arrival_instructions",
      body: "A driver will meet you.",
      visibility: "guest",
    },
    {
      fieldKey: "lockbox_instructions",
      body: "Code 4821 under the lantern.",
      visibility: "guest",
    },
    {
      fieldKey: "private_notes",
      body: "Owner prefers no weekend parties.",
      visibility: "private",
    },
  ],
  knowledge: [
    {
      id: "33333333-3333-4333-8333-333333333333",
      title: "Public Wi-Fi name",
      category: "wifi",
      body: "AtlasGuest",
      locale: "en",
      status: "published",
      visibility: "public",
      sortOrder: 10,
    },
    {
      id: "44444444-4444-4444-8444-444444444444",
      title: "Wi-Fi password",
      category: "wifi",
      body: "secret-password",
      locale: "en",
      status: "published",
      visibility: "guest",
      sortOrder: 20,
    },
    {
      id: "55555555-5555-4555-8555-555555555555",
      title: "Vendor codes",
      category: "other",
      body: "Internal alarm code 99",
      locale: "en",
      status: "published",
      visibility: "private",
      sortOrder: 30,
    },
    {
      id: "66666666-6666-4666-8666-666666666666",
      title: "Draft note",
      category: "other",
      body: "Not ready",
      locale: "en",
      status: "draft",
      visibility: "public",
      sortOrder: 40,
    },
  ],
  media: [
    {
      id: "77777777-7777-4777-8777-777777777777",
      mediaType: "image",
      role: "hero",
      storagePath: "organizations/22222222-2222-4222-8222-222222222222/properties/11111111-1111-4111-8111-111111111111/media/77777777-7777-4777-8777-777777777777.jpg",
      externalUrl: null,
      sortOrder: 10,
      caption: "Courtyard",
      altText: "Courtyard pool",
      visibility: "public",
    },
    {
      id: "88888888-8888-4888-8888-888888888888",
      mediaType: "image",
      role: "gallery",
      storagePath: "organizations/22222222-2222-4222-8222-222222222222/properties/11111111-1111-4111-8111-111111111111/media/88888888-8888-4888-8888-888888888888.jpg",
      externalUrl: null,
      sortOrder: 20,
      caption: "Safe location",
      altText: "Safe",
      visibility: "private",
    },
  ],
};

describe("property CMS visibility loaders", () => {
  it("omits internal identifiers, private notes, and guest-only access from public content", () => {
    const publicContent = getPublicPropertyContent(snapshot);

    expect(publicContent).not.toHaveProperty("internalIdentifier");
    expect(publicContent).not.toHaveProperty("slug");
    expect(publicContent.content.neighborhood).toBe("In the medina, near Jemaa el-Fnaa.");
    expect(publicContent.content.arrival_instructions).toBeUndefined();
    expect(publicContent.content.lockbox_instructions).toBeUndefined();
    expect(publicContent.content.private_notes).toBeUndefined();
    expect(publicContent.houseRules.map((rule) => rule.ruleKey)).toEqual(["smoking"]);
    expect(publicContent.knowledge.map((entry) => entry.title)).toEqual(["Public Wi-Fi name"]);
    expect(publicContent.media).toHaveLength(1);
    expect(publicPropertyContentHasPrivateData(publicContent)).toBe(false);
    expect(JSON.stringify(publicContent)).not.toContain("ATLAS-SECRET");
    expect(JSON.stringify(publicContent)).not.toContain("4821");
    expect(JSON.stringify(publicContent)).not.toContain("secret-password");
    expect(JSON.stringify(publicContent)).not.toContain("Owner prefers");
  });

  it("lets guests see guest-visible access and instructions but not operator-private content", () => {
    const guestContent = getGuestPropertyContent(snapshot);

    expect(guestContent).not.toHaveProperty("internalIdentifier");
    expect(guestContent.content.arrival_instructions).toBe("A driver will meet you.");
    expect(guestContent.content.lockbox_instructions).toBe("Code 4821 under the lantern.");
    expect(guestContent.content.private_notes).toBeUndefined();
    expect(guestContent.knowledge.map((entry) => entry.title)).toEqual([
      "Public Wi-Fi name",
      "Wi-Fi password",
    ]);
    expect(JSON.stringify(guestContent)).not.toContain("ATLAS-SECRET");
    expect(JSON.stringify(guestContent)).not.toContain("Vendor codes");
    expect(JSON.stringify(guestContent)).not.toContain("Internal alarm");
    expect(JSON.stringify(guestContent)).not.toContain("Owner prefers");
  });

  it("does not treat unpublished knowledge as public even when visibility is public", () => {
    const publicContent = getPublicPropertyContent(snapshot);
    expect(publicContent.knowledge.some((entry) => entry.title === "Draft note")).toBe(false);
  });
});
