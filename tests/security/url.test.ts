import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("auth redirect host control", () => {
  it("builds invitation and signup redirects on the server from the canonical origin", () => {
    const provision = read("src/lib/admin/provision.ts");
    const members = read("src/lib/admin/members.ts");
    const signup = read("src/lib/commercial/actions.ts");
    const signOut = read("src/lib/auth/actions.ts");

    for (const source of [provision, members, signup]) {
      expect(source).toContain('authRedirectUrl("/login")');
      expect(source).not.toContain("localhost:3000");
      expect(source).not.toContain("onwarda-3bux.vercel.app");
      expect(source).not.toContain('formData.get("redirect');
      expect(source).not.toContain("window.location");
    }

    expect(signOut).toContain("safeInternalPath(redirectTo, \"/login\")");
  });

  it("keeps service-role credentials and tokens out of the URL helper", () => {
    const source = read("src/lib/url.ts");

    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(source).not.toContain("createServiceRoleClient");
    expect(source).not.toContain("console.log");
    expect(source).not.toContain("organization_id");
    expect(source).not.toContain("token");
  });
});
