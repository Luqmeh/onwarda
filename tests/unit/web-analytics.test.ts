import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { publicMarketingPath } from "@/lib/marketing/web-analytics";

describe("public marketing analytics", () => {
  it("keeps page views on public marketing paths and strips queries", () => {
    expect(publicMarketingPath("/")).toBe("/");
    expect(publicMarketingPath("/pricing")).toBe("/pricing");
    expect(publicMarketingPath("/signup?plan=starter")).toBe("/signup");
    expect(publicMarketingPath("https://onwarda.example/product?ref=home")).toBe("/product");
  });

  it("drops private, tokenized, and authentication routes", () => {
    expect(publicMarketingPath("/admin")).toBeNull();
    expect(publicMarketingPath("/admin/clients")).toBeNull();
    expect(publicMarketingPath("/app")).toBeNull();
    expect(publicMarketingPath("/app/guests")).toBeNull();
    expect(publicMarketingPath("/o/acme")).toBeNull();
    expect(publicMarketingPath("/g/guest-token")).toBeNull();
    expect(publicMarketingPath("/cleaner/cleaner-token")).toBeNull();
    expect(publicMarketingPath("/login")).toBeNull();
    expect(publicMarketingPath("/admin/login")).toBeNull();
    expect(publicMarketingPath("/onboarding")).toBeNull();
    expect(publicMarketingPath("/p/acme/courtyard")).toBeNull();
  });

  it("mounts Vercel Analytics only from the marketing layout", () => {
    const root = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");
    const marketing = readFileSync(join(process.cwd(), "src/app/(marketing)/layout.tsx"), "utf8");
    const component = readFileSync(join(process.cwd(), "src/components/marketing/marketing-analytics.tsx"), "utf8");

    expect(root).not.toContain("@vercel/analytics");
    expect(marketing).toContain("MarketingAnalytics");
    expect(component).toContain('@vercel/analytics/next');
    expect(component).toContain("beforeSend");
    expect(component).not.toContain("track(");
  });
});