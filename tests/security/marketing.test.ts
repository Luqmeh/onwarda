import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function walkSource(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = join(directory, entry);
    return statSync(fullPath).isDirectory() ? walkSource(fullPath) : [fullPath];
  });
}

describe("marketing website isolation", () => {
  it("renders canonical published plans from centralized config", () => {
    const pricing = readFileSync(join(process.cwd(), "src/config/pricing.ts"), "utf8");
    const page = readFileSync(join(process.cwd(), "src/app/(marketing)/pricing/page.tsx"), "utf8");
    const home = readFileSync(join(process.cwd(), "src/app/(marketing)/page.tsx"), "utf8");

    expect(pricing).toContain("COMMERCIAL_PLANS");
    expect(page).toContain("PricingCards");
    expect(page).not.toContain("299");
    expect(home).toContain("operating layer for hospitality");
    expect(home).toContain("listPublishedCommercialPlans");
    expect(home).not.toContain("299");
    expect(home).not.toContain("COGS");
    expect(home).not.toContain("createServiceRoleClient");
  });

  it("keeps service role and tenant loaders out of marketing UI", () => {
    const files = [
      ...walkSource(join(process.cwd(), "src/app/(marketing)")),
      ...walkSource(join(process.cwd(), "src/components/marketing")),
    ];

    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toContain("createServiceRoleClient");
      expect(source, file).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
      expect(source, file).not.toContain("get_guest_stay_bundle");
      expect(source, file).not.toContain("getWorkspaceDashboard");
    }
  });

  it("preserves existing security contexts", () => {
    const admin = readFileSync(join(process.cwd(), "src/app/admin/(console)/layout.tsx"), "utf8");
    const workspace = readFileSync(join(process.cwd(), "src/app/app/page.tsx"), "utf8");
    const property = readFileSync(
      join(process.cwd(), "src/app/p/[organizationSlug]/[propertySlug]/page.tsx"),
      "utf8",
    );
    const guest = readFileSync(join(process.cwd(), "src/app/g/[token]/page.tsx"), "utf8");

    expect(admin).toContain("getPlatformAdminMfaGate");
    expect(workspace).toContain("getWorkspaceDashboard");
    expect(property).toContain("loadPublicPropertyShowcase");
    expect(guest).toContain("loadGuestStayOrMark");
  });
});
