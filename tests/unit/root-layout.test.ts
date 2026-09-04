import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("root layout hydration", () => {
  it("suppresses extension-injected html and body attribute mismatches", () => {
    const layout = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");

    expect(layout).toContain("suppressHydrationWarning");
    expect(layout).toMatch(/<html[\s\S]*suppressHydrationWarning/);
    expect(layout).toMatch(/<body[\s\S]*suppressHydrationWarning/);
  });
});
