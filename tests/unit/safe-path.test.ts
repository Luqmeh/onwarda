import { describe, expect, it } from "vitest";

import { safeInternalPath } from "@/lib/auth/safe-path";

describe("post-login redirect sanitization", () => {
  it("allows admin and client workspace paths", () => {
    expect(safeInternalPath("/admin", "/app")).toBe("/admin");
    expect(safeInternalPath("/app", "/login")).toBe("/app");
  });

  it("rejects protocol-relative and external URLs", () => {
    expect(safeInternalPath("//evil.example", "/app")).toBe("/app");
    expect(safeInternalPath("https://evil.example", "/app")).toBe("/app");
    expect(safeInternalPath("/\\evil.example", "/app")).toBe("/app");
  });

  it("allows same-origin organization access paths", () => {
    expect(safeInternalPath("/o/riad-atlas", "/app")).toBe("/o/riad-atlas");
  });

  it("rejects unrelated internal paths", () => {
    expect(safeInternalPath("/g/sometoken", "/app")).toBe("/app");
    expect(safeInternalPath("/o/../admin", "/app")).toBe("/app");
  });
});
