import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function walkSource(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = join(directory, entry);
    return statSync(fullPath).isDirectory() ? walkSource(fullPath) : [fullPath];
  });
}

describe("guest portal source isolation", () => {
  const root = join(process.cwd(), "src");

  it("resolves the stay from the token and guest-safe projector", () => {
    const home = readFileSync(join(root, "app/g/[token]/page.tsx"), "utf8");
    const loader = readFileSync(join(root, "lib/guest-portal/load.ts"), "utf8");
    const actions = readFileSync(join(root, "lib/guest-portal/actions.ts"), "utf8");

    expect(home).toContain("loadGuestStayOrMark");
    expect(home).not.toContain("createServiceRoleClient");
    expect(loader).toContain("getGuestPropertyContent");
    expect(loader).toContain("inspectGuestPortalToken");
    expect(actions).toContain("p_token_hash");
    expect(actions).not.toContain('formData.get("organizationId")');
    expect(actions).not.toContain('formData.get("propertyId")');
    expect(actions).not.toContain('formData.get("reservationId")');
    expect(actions).not.toContain('formData.get("guestId")');
    expect(actions).not.toContain('formData.get("step")');
    expect(actions).not.toContain("searchParams");
    expect(actions).not.toContain("console.log");
    expect(loader).toContain("getGuestJourney");
    expect(loader).toContain("p_token_hash");
  });

  it("projects the journey from token-scoped stay data only", () => {
    const journey = readFileSync(join(root, "lib/guest-portal/journey.ts"), "utf8");
    const loader = readFileSync(join(root, "lib/guest-portal/load.ts"), "utf8");
    const actions = readFileSync(join(root, "lib/guest-portal/actions.ts"), "utf8");
    const home = readFileSync(join(root, "app/g/[token]/page.tsx"), "utf8");
    const rules = readFileSync(join(root, "app/g/[token]/rules/page.tsx"), "utf8");

    expect(journey).toContain("export function getGuestJourney");
    expect(journey).not.toContain("createServiceRoleClient");
    expect(loader).toContain("hasGuestVisibleRules: content.houseRules.length > 0");
    expect(actions).toContain("inspectGuestPortalToken");
    expect(actions).toContain("guest_update_arrival_notes");
    expect(actions).not.toContain("p_reservation_id");
    expect(home).toContain("const { journey } = stay");
    expect(rules).toContain("No house rules have been provided for this stay");
    expect(rules).not.toContain("The host has not published guest-visible house rules yet.");
  });

  it("does not put service-role usage in guest pages or client forms", () => {
    const files = [
      ...walkSource(join(root, "app/g")),
      ...walkSource(join(root, "components/guest")),
    ];

    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toContain("createServiceRoleClient");
      expect(source, file).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
      expect(source, file).not.toContain("@/lib/database/admin");
      expect(source, file).not.toContain("/app/");
    }
  });

  it("does not log raw guest tokens in guest-portal modules", () => {
    const files = walkSource(join(root, "lib/guest-portal"));

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toContain("console.log");
      expect(source, file).not.toContain("console.info");
      expect(source, file).not.toContain("console.debug");
    }
  });
});
