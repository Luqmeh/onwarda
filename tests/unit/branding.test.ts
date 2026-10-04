import { describe, expect, it } from "vitest";

import { ONWARDA_COLOR_TOKENS } from "@/config/brand";
import {
  isSafeBrandColor,
  normalizeBrandColor,
  parseOptionalBrandColor,
} from "@/lib/branding/colors";
import {
  BRANDING_LOGO_MAX_BYTES,
  brandingLogoPath,
  brandingOrganizationIdFromLogoPath,
  detectBrandingLogoType,
  isBrandingLogoPath,
  validateBrandingLogoBytes,
} from "@/lib/branding/logo";
import {
  organizationBrandStyle,
  resolveOrganizationBranding,
} from "@/lib/branding/resolve";
import { PRIVATE_STORAGE_BUCKETS } from "@/lib/storage/paths";
import { organizationBrandingFieldsSchema } from "@/lib/validation/branding";

const ORG_ID = "11111111-1111-4111-8111-111111111111";

function pngBytes(length = 16) {
  const bytes = new Uint8Array(length);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return bytes;
}

describe("brand color validation", () => {
  it("accepts only 6-digit hex colors", () => {
    expect(isSafeBrandColor("#77764F")).toBe(true);
    expect(normalizeBrandColor("#77764F")).toBe("#77764f");
    expect(parseOptionalBrandColor("#DD817A")).toBe("#dd817a");
    expect(parseOptionalBrandColor("")).toBeNull();
    expect(parseOptionalBrandColor(null)).toBeNull();
  });

  it("rejects CSS, URLs, and script injection", () => {
    const rejected = [
      "url(https://evil.example/x)",
      "javascript:alert(1)",
      "var(--client-primary)",
      "--client-primary",
      "#77764F; background: red",
      "<script>alert(1)</script>",
      "expression(alert(1))",
      "#fff",
      "red",
      "rgb(119,118,79)",
    ];

    for (const value of rejected) {
      expect(isSafeBrandColor(value), value).toBe(false);
      expect(normalizeBrandColor(value), value).toBeNull();
      expect(organizationBrandingFieldsSchema.safeParse({
        displayName: null,
        primaryColor: value,
        secondaryColor: null,
        accentColor: null,
      }).success, value).toBe(false);
    }
  });
});

describe("logo validation", () => {
  it("accepts PNG, JPEG, and WebP magic bytes", () => {
    expect(detectBrandingLogoType(pngBytes())?.extension).toBe("png");
    expect(
      detectBrandingLogoType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.extension,
    ).toBe("jpg");
    expect(
      detectBrandingLogoType(
        new Uint8Array([
          0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
        ]),
      )?.extension,
    ).toBe("webp");
  });

  it("rejects SVG, executables, and oversized files", () => {
    const svg = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>");
    const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);

    expect(() => validateBrandingLogoBytes(svg)).toThrow(/png, jpeg, or webp/i);
    expect(() => validateBrandingLogoBytes(exe)).toThrow(/png, jpeg, or webp/i);
    expect(() => validateBrandingLogoBytes(new Uint8Array(0))).toThrow(/image file/i);
    expect(() =>
      validateBrandingLogoBytes(new Uint8Array(BRANDING_LOGO_MAX_BYTES + 1)),
    ).toThrow(/2 mb/i);
  });

  it("keeps logo paths organization-scoped", () => {
    const path = brandingLogoPath(ORG_ID, "png");

    expect(path).toBe(`organizations/${ORG_ID}/branding/logo.png`);
    expect(isBrandingLogoPath(path)).toBe(true);
    expect(brandingOrganizationIdFromLogoPath(path)).toBe(ORG_ID);
    expect(isBrandingLogoPath(`organizations/${ORG_ID}/stolen.svg`)).toBe(false);
    expect(isBrandingLogoPath(`organizations/${ORG_ID}/branding/logo.svg`)).toBe(false);
    expect(
      brandingOrganizationIdFromLogoPath(
        `organizations/22222222-2222-4222-8222-222222222222/branding/logo.png`,
      ),
    ).toBe("22222222-2222-4222-8222-222222222222");
    expect(PRIVATE_STORAGE_BUCKETS.organizationBranding).toBe("organization-branding");
  });
});

describe("branding fallbacks", () => {
  it("uses the organization name and Onwarda colors when branding is empty", () => {
    const branding = resolveOrganizationBranding({
      organizationId: ORG_ID,
      organizationName: "Riad Atlas",
      branding: null,
    });

    expect(branding.displayName).toBe("Riad Atlas");
    expect(branding.logoPath).toBeNull();
    expect(branding.primaryColor).toBe(ONWARDA_COLOR_TOKENS.olive);
    expect(branding.secondaryColor).toBe(ONWARDA_COLOR_TOKENS.sage);
    expect(branding.accentColor).toBe(ONWARDA_COLOR_TOKENS.coral);
    expect(branding.storedDisplayName).toBeNull();
    expect(branding.storedPrimaryColor).toBeNull();
  });

  it("prefers stored display name and validated colors", () => {
    const branding = resolveOrganizationBranding({
      organizationId: ORG_ID,
      organizationName: "Riad Atlas",
      branding: {
        display_name: "Atlas House",
        public_description: null,
        logo_path: `organizations/${ORG_ID}/branding/logo.png`,
        primary_color: "#123456",
        secondary_color: "javascript:alert(1)",
        accent_color: "#DD817A",
      },
    });

    expect(branding.displayName).toBe("Atlas House");
    expect(branding.primaryColor).toBe("#123456");
    expect(branding.secondaryColor).toBe(ONWARDA_COLOR_TOKENS.sage);
    expect(branding.accentColor).toBe("#dd817a");
    expect(organizationBrandStyle(branding)).toMatchObject({
      "--client-primary": "#123456",
      "--client-accent": "#dd817a",
    });
  });
});
