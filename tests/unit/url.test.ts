import { describe, expect, it } from "vitest";

import {
  cleanerProfileUrl,
  clientAccessUrl,
  guestPortalUrl,
  publicPropertyPath,
} from "@/config/app";
import { safeInternalPath } from "@/lib/auth/safe-path";
import {
  AppUrlConfigurationError,
  buildAppUrl,
  resolveAppUrl,
} from "@/lib/url";

const PRODUCTION = "https://onwarda-3bux.vercel.app";
const PREVIEW_HOST = "onwarda-3bux-fui39cmbe-ayoubelghazely-gmailcoms-projects.vercel.app";

describe("application URL resolution", () => {
  it("uses the explicit production origin and ignores the deployment hostname", () => {
    expect(
      resolveAppUrl({
        configuredUrl: `${PRODUCTION}/`,
        nodeEnv: "production",
        vercelEnv: "production",
        vercelUrl: PREVIEW_HOST,
      }),
    ).toBe(PRODUCTION);
  });

  it("uses localhost only for development", () => {
    expect(resolveAppUrl({ nodeEnv: "development" })).toBe("http://localhost:3000");
    expect(resolveAppUrl({ configuredUrl: "http://localhost:3000/", nodeEnv: "development" })).toBe(
      "http://localhost:3000",
    );
  });

  it("uses the current Vercel preview host when no explicit origin is set", () => {
    expect(
      resolveAppUrl({
        nodeEnv: "production",
        vercelEnv: "preview",
        vercelUrl: PREVIEW_HOST,
      }),
    ).toBe(`https://${PREVIEW_HOST}`);
  });

  it("refuses to fall back to localhost in production or preview", () => {
    expect(() => resolveAppUrl({ nodeEnv: "production" })).toThrow(AppUrlConfigurationError);
    expect(() =>
      resolveAppUrl({ nodeEnv: "production", vercelEnv: "production", vercelUrl: PREVIEW_HOST }),
    ).toThrow(/localhost/i);
    expect(() =>
      resolveAppUrl({
        configuredUrl: "http://localhost:3000",
        vercelEnv: "production",
      }),
    ).toThrow(/localhost/i);
    expect(() => resolveAppUrl({ nodeEnv: "production", vercelEnv: "preview" })).toThrow(
      AppUrlConfigurationError,
    );
  });

  it("rejects malformed origins", () => {
    expect(() => resolveAppUrl({ configuredUrl: "not a url" })).toThrow(AppUrlConfigurationError);
    expect(() => resolveAppUrl({ configuredUrl: "javascript:alert(1)" })).toThrow(
      AppUrlConfigurationError,
    );
    expect(() => resolveAppUrl({ configuredUrl: "data:text/html,hi" })).toThrow(
      AppUrlConfigurationError,
    );
  });
});

describe("absolute application URLs", () => {
  it("normalizes invite, signup, guest, cleaner, property, and organization URLs", () => {
    expect(buildAppUrl(PRODUCTION, "/login")).toBe(`${PRODUCTION}/login`);
    expect(buildAppUrl(`${PRODUCTION}/`, "/signup?plan=professional")).toBe(
      `${PRODUCTION}/signup?plan=professional`,
    );
    expect(guestPortalUrl(PRODUCTION, "opaque-token")).toBe(`${PRODUCTION}/g/opaque-token`);
    expect(cleanerProfileUrl("http://localhost:3000", "opaque-token")).toBe(
      "http://localhost:3000/cleaner/opaque-token",
    );
    expect(buildAppUrl(PRODUCTION, publicPropertyPath("riad-atlas", "riad-suite"))).toBe(
      `${PRODUCTION}/p/riad-atlas/riad-suite`,
    );
    expect(clientAccessUrl(PRODUCTION, "riad-atlas")).toBe(`${PRODUCTION}/o/riad-atlas`);
  });

  it("rejects paths that leave the application origin", () => {
    expect(() => buildAppUrl(PRODUCTION, "//evil.example.com")).toThrow(AppUrlConfigurationError);
    expect(() => buildAppUrl(PRODUCTION, "https://evil.example.com")).toThrow(AppUrlConfigurationError);
    expect(() => buildAppUrl(PRODUCTION, "javascript:alert(1)")).toThrow(AppUrlConfigurationError);
    expect(buildAppUrl(PRODUCTION, "/signup?plan=professional")).not.toContain("//signup");
  });
});

describe("login continuation", () => {
  it("keeps internal next paths and rejects external hosts", () => {
    expect(safeInternalPath("/app", "/login")).toBe("/app");
    expect(safeInternalPath("/admin", "/login")).toBe("/admin");
    expect(safeInternalPath("/signup?plan=starter", "/login")).toBe("/signup?plan=starter");
    expect(safeInternalPath("https://evil.example.com", "/app")).toBe("/app");
    expect(safeInternalPath("//evil.example.com", "/app")).toBe("/app");
    expect(safeInternalPath("javascript:alert(1)", "/app")).toBe("/app");
    expect(safeInternalPath("data:text/html,hi", "/app")).toBe("/app");
  });
});
