import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("local client bootstrap source safety", () => {
  it("reads client credentials from the environment or CLI instead of constants", () => {
    const source = readFileSync(resolve("scripts/bootstrap-client.ts"), "utf8");

    expect(source).toContain("ONWARDA_DEV_CLIENT_EMAIL");
    expect(source).toContain("ONWARDA_DEV_CLIENT_PASSWORD");
    expect(source).toContain('readArg("email")');
    expect(source).toContain('readArg("password")');
    expect(source).not.toMatch(/ONWARDA_DEV_CLIENT_EMAIL\s*=\s*["'`]/);
    expect(source).not.toMatch(/ONWARDA_DEV_CLIENT_PASSWORD\s*=\s*["'`]/);
    expect(source).toContain("assertLocalSupabaseUrl");
    expect(source).toContain("platform_admins");
    expect(source).toContain("different organization");
  });

  it("is registered as a local-only npm script", () => {
    const pkg = JSON.parse(readFileSync(resolve("package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(pkg.scripts["bootstrap:client"]).toBe("tsx scripts/bootstrap-client.ts");
  });
});
