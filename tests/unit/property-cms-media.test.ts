import { describe, expect, it } from "vitest";

import {
  detectPropertyImageType,
  isPropertyMediaObjectPath,
  propertyIdFromMediaPath,
  propertyMediaObjectPath,
  validatePropertyImageBytes,
} from "@/lib/property-cms/media";
import { isAllowedExternalMediaUrl, parseHttpsUrl } from "@/lib/property-cms/urls";

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const SVG = Uint8Array.from(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"));

describe("property media paths and files", () => {
  it("builds a tenant-scoped media path", () => {
    const path = propertyMediaObjectPath(
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
      "webp",
    );

    expect(path).toBe(
      "organizations/11111111-1111-4111-8111-111111111111/properties/22222222-2222-4222-8222-222222222222/media/33333333-3333-4333-8333-333333333333.webp",
    );
    expect(isPropertyMediaObjectPath(path)).toBe(true);
    expect(propertyIdFromMediaPath(path)).toBe("22222222-2222-4222-8222-222222222222");
  });

  it("rejects traversal and public-looking paths", () => {
    expect(
      isPropertyMediaObjectPath(
        "../organizations/11111111-1111-4111-8111-111111111111/properties/22222222-2222-4222-8222-222222222222/media/33333333-3333-4333-8333-333333333333.png",
      ),
    ).toBe(false);
    expect(isPropertyMediaObjectPath("organizations/riad-atlas/hero.png")).toBe(false);
  });

  it("accepts PNG magic bytes and rejects SVG", () => {
    expect(detectPropertyImageType(PNG)?.extension).toBe("png");
    expect(detectPropertyImageType(SVG)).toBeNull();
    expect(() => validatePropertyImageBytes(SVG)).toThrow(/PNG, JPEG, or WebP/);
  });
});

describe("external media URLs", () => {
  it("allows https YouTube and Matterport URLs", () => {
    expect(
      isAllowedExternalMediaUrl("https://www.youtube.com/watch?v=abcdefghijk", "video"),
    ).toBe(true);
    expect(
      isAllowedExternalMediaUrl("https://my.matterport.com/show/?m=example", "tour_360"),
    ).toBe(true);
  });

  it("rejects iframe HTML, javascript URLs, and unknown hosts", () => {
    expect(parseHttpsUrl("javascript:alert(1)")).toBeNull();
    expect(parseHttpsUrl('<iframe src="https://youtube.com"></iframe>')).toBeNull();
    expect(isAllowedExternalMediaUrl("https://evil.example/video", "video")).toBe(false);
    expect(isAllowedExternalMediaUrl("http://youtube.com/watch?v=abcdefghijk", "video")).toBe(
      false,
    );
  });
});
