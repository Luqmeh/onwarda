import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("client entry and login", () => {
  const root = join(process.cwd(), "src");

  it("preserves a safe /o/[slug] return path and handles platform admins separately", () => {
    const slugPage = readFileSync(join(root, "app/o/[slug]/page.tsx"), "utf8");

    expect(slugPage).toContain("safeInternalPath");
    expect(slugPage).toContain("getPlatformAdminContext");
    expect(slugPage).toContain("This is a client workspace.");
    expect(slugPage).toContain("Use Support Mode from the Internal Admin");
    expect(slugPage).toContain("ADMIN_ROUTES.clients");
    expect(slugPage).toContain("Wrong organization");
    expect(slugPage).not.toContain("requirePlatformAdmin");
    expect(slugPage).not.toContain("createServiceRoleClient");
    expect(slugPage).not.toMatch(/organizationId\s*=/);
  });

  it("keeps client login on the hospitality design system", () => {
    const login = readFileSync(join(root, "app/login/page.tsx"), "utf8");

    expect(login).toContain("onwarda-client");
    expect(login).toContain("safeInternalPath");
    expect(login).toContain("SignOutButton");
    expect(login).not.toContain("AdminShell");
    expect(login).not.toContain("requirePlatformAdmin");
  });
});
