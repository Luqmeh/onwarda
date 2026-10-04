import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function walk(directory: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }

    if (fullPath.endsWith(".ts") || fullPath.endsWith(".tsx")) {
      files.push(fullPath);
    }
  }

  return files;
}

describe("cleaner surface isolation", () => {
  it("keeps service role and raw token logging out of cleaner UI", () => {
    const files = [
      ...walk(join(process.cwd(), "src/app/cleaner")),
      ...walk(join(process.cwd(), "src/components/cleaner")),
      ...walk(join(process.cwd(), "src/components/workspace")).filter((file) =>
        file.includes("cleaning"),
      ),
    ];

    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toContain("createServiceRoleClient");
      expect(source, file).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
      expect(source, file).not.toContain("console.log");
      expect(source, file).not.toContain("token_hash");
    }
  });

  it("hashes cleaner links before they reach the database", () => {
    const actions = readFileSync(join(process.cwd(), "src/lib/cleaning/actions.ts"), "utf8");
    const access = readFileSync(join(process.cwd(), "src/lib/cleaning/cleaner-access.ts"), "utf8");

    expect(actions).toContain("generateCleanerToken");
    expect(actions).toContain("p_token_hash: issued.hash");
    expect(actions).not.toContain("p_token_hash: issued.token");
    expect(access).toContain("hashCleanerToken");
    expect(access).toContain("createServiceRoleClient");
  });

  it("derives manual cleaning and assignment from the server, not a browser organization id", () => {
    const actions = readFileSync(join(process.cwd(), "src/lib/cleaning/actions.ts"), "utf8");
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/20261004010000_manual_cleaning.sql"),
      "utf8",
    );

    expect(actions).toContain("createManualCleaningAction");
    expect(actions).toContain("requireOrganizationRole(ORGANIZATION_OPERATIONAL_ROLES)");
    expect(actions).not.toContain('formData.get("organizationId")');
    expect(actions).not.toContain("formData.get('organizationId')");
    expect(migration).toContain("current_user_has_org_role(v_org, array['owner', 'admin', 'manager'])");
    expect(migration).toContain("v_task.assigned_agent_id is distinct from v_inspect.cleaning_agent_id");
    expect(migration).not.toContain("p_organization_id");
  });

  it("does not give cleaners a workspace or admin session", () => {
    const proxy = readFileSync(join(process.cwd(), "src/proxy.ts"), "utf8");
    const home = readFileSync(join(process.cwd(), "src/app/cleaner/[token]/page.tsx"), "utf8");

    expect(proxy).not.toContain("/cleaner");
    expect(home).not.toContain("requireCurrentOrganization");
    expect(home).not.toContain("requirePlatformAdmin");
  });
});
