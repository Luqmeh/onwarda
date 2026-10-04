import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function walkSource(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = join(directory, entry);
    return statSync(fullPath).isDirectory() ? walkSource(fullPath) : [fullPath];
  });
}

describe("public experience source isolation", () => {
  const root = join(process.cwd(), "src");

  it("keeps public pages on slug loaders and the public-safe projector", () => {
    const portfolio = readFileSync(
      join(root, "app/p/[organizationSlug]/page.tsx"),
      "utf8",
    );
    const property = readFileSync(
      join(root, "app/p/[organizationSlug]/[propertySlug]/page.tsx"),
      "utf8",
    );
    const loader = readFileSync(join(root, "lib/public/load.ts"), "utf8");

    expect(portfolio).toContain("loadPublicOperatorPortfolio");
    expect(property).toContain("loadPublicPropertyShowcase");
    expect(property).not.toContain("from(\"properties\")");
    expect(loader).toContain("getPublicPropertyContent");
    expect(loader).toContain("get_public_operator_portfolio");
    expect(loader).toContain("get_public_property_showcase");
    expect(loader).not.toContain("formData.get(\"organizationId\")");
  });

  it("does not put service-role usage in public pages or client components", () => {
    const files = [
      ...walkSource(join(root, "app/p")),
      ...walkSource(join(root, "components/public")),
    ];

    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toContain("createServiceRoleClient");
      expect(source, file).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
      expect(source, file).not.toContain("@/lib/database/admin");
    }
  });

  it("authorizes public media by slug and media id, never a browser path", () => {
    const media = readFileSync(join(root, "lib/public/media.ts"), "utf8");
    expect(media).toContain("authorize_public_property_media");
    expect(media).toContain("isPropertyMediaObjectPath");
    expect(media).not.toContain("formData.get(\"path\")");
    expect(media).not.toContain("searchParams");
  });
});
