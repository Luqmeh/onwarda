import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  assertLocalSupabaseUrl,
  isLocalSupabaseUrl,
  parseDotEnv,
} from "../../scripts/local-supabase";

describe("local admin bootstrap environment guard", () => {
  it("accepts loopback Supabase URLs", () => {
    expect(isLocalSupabaseUrl("http://127.0.0.1:54321")).toBe(true);
    expect(isLocalSupabaseUrl("http://localhost:54321")).toBe(true);
    expect(isLocalSupabaseUrl("http://[::1]:54321")).toBe(true);
  });

  it("refuses hosted and production Supabase URLs", () => {
    expect(isLocalSupabaseUrl("https://abcdefgh.supabase.co")).toBe(false);
    expect(isLocalSupabaseUrl("https://abcdefgh.supabase.net")).toBe(false);
    expect(
      isLocalSupabaseUrl("https://onwarda.example.com"),
    ).toBe(false);

    expect(() =>
      assertLocalSupabaseUrl("https://abcdefgh.supabase.co"),
    ).toThrow(/local development Supabase/i);
  });

  it("parses env files without requiring quoted values", () => {
    const parsed = parseDotEnv(
      ["# comment", "ONWARDA_DEV_ADMIN_EMAIL=dev-admin@example.test", ""].join(
        "\n",
      ),
    );

    expect(parsed.ONWARDA_DEV_ADMIN_EMAIL).toBe("dev-admin@example.test");
  });
});

describe("local admin bootstrap source safety", () => {
  it("keeps .env.local out of git", () => {
    const gitignore = readFileSync(resolve(".gitignore"), "utf8");

    expect(gitignore).toMatch(/^\.env\*/m);
    expect(gitignore).toMatch(/\.env\.local/);
  });

  it("reads admin credentials from the environment instead of constants", () => {
    const source = readFileSync(
      resolve("scripts/bootstrap-admin.ts"),
      "utf8",
    );

    expect(source).toContain('requiredEnv("ONWARDA_DEV_ADMIN_EMAIL")');
    expect(source).toContain('requiredEnv("ONWARDA_DEV_ADMIN_PASSWORD")');
    expect(source).not.toMatch(/ONWARDA_DEV_ADMIN_EMAIL\s*=\s*["'`]/);
    expect(source).not.toMatch(/ONWARDA_DEV_ADMIN_PASSWORD\s*=\s*["'`]/);
  });
});
