import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { cleanerProfileUrl } from "@/config/app";
import { CLEANING_CHECKLIST } from "@/lib/cleaning/catalog";
import {
  canFinishCleaning,
  checklistProgress,
  readinessAfterTasks,
} from "@/lib/cleaning/progress";
import { cleanerTokensMatch, generateCleanerToken, hashCleanerToken } from "@/lib/cleaning/tokens";

describe("cleaner tokens", () => {
  it("generates a long opaque token and stores only a hash", () => {
    const issued = generateCleanerToken();

    expect(issued.token.length).toBeGreaterThanOrEqual(32);
    expect(issued.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(issued.hash).not.toContain(issued.token);
    expect(cleanerTokensMatch(issued.token, issued.hash)).toBe(true);
    expect(hashCleanerToken(issued.token)).toBe(issued.hash);
    expect(cleanerTokensMatch("other-token-value-not-the-same", issued.hash)).toBe(false);
  });

  it("rotates by producing a different hash", () => {
    const first = generateCleanerToken();
    const second = generateCleanerToken();

    expect(second.token).not.toBe(first.token);
    expect(cleanerTokensMatch(first.token, second.hash)).toBe(false);
  });
});

describe("cleaner profile URL", () => {
  const token = "lMf8mqup-1YlPm0KuV4MhrRQSGvSN3qaKKehiCvemX8";

  it("builds an absolute URL from the configured origin", () => {
    const local = cleanerProfileUrl("http://localhost:3000", token);
    const production = cleanerProfileUrl("https://app.example.test", token);

    expect(local).toBe(`http://localhost:3000/cleaner/${token}`);
    expect(production).toBe(`https://app.example.test/cleaner/${token}`);

    for (const displayed of [local, production]) {
      const parsed = new URL(displayed);
      const copied = displayed;

      expect(parsed.protocol === "http:" || parsed.protocol === "https:").toBe(true);
      expect(parsed.pathname).toBe(`/cleaner/${token}`);
      expect(parsed.pathname.split(token)).toHaveLength(2);
      expect(parsed.search).toBe("");
      expect(parsed.hash).toBe("");
      expect(copied).toBe(displayed);
      expect(displayed).not.toContain(hashCleanerToken(token));
    }
  });

  it("shows and copies the same absolute link", () => {
    const form = readFileSync(
      join(process.cwd(), "src/components/workspace/cleaning-forms.tsx"),
      "utf8",
    );
    const actions = readFileSync(join(process.cwd(), "src/lib/cleaning/actions.ts"), "utf8");

    expect(actions).toContain("cleanerProfileUrl(getAppUrl(), issued.token)");
    expect(actions).toContain("p_token_hash: issued.hash");
    expect(form).toContain("href={state.link}");
    expect(form).toContain("CopyLinkButton value={state.link}");
    expect(form).toContain("{state.link}");
  });
});

describe("cleaning checklist progress", () => {
  it("counts required items and blocks completion until they are done", () => {
    const items = CLEANING_CHECKLIST.map((item, index) => ({
      required: item.required,
      completedAt: index === 0 ? "2026-09-27T12:00:00.000Z" : null,
    }));
    const progress = checklistProgress(items);

    expect(CLEANING_CHECKLIST).toHaveLength(17);
    expect(progress.total).toBe(17);
    expect(progress.completed).toBe(1);
    expect(progress.ready).toBe(false);
    expect(
      canFinishCleaning({
        status: "in_progress",
        items,
        confirmCleaning: true,
        confirmLeft: true,
      }),
    ).toBe(false);
  });

  it("allows completion only after the checklist and both confirmations", () => {
    const items = CLEANING_CHECKLIST.map(() => ({
      required: true,
      completedAt: "2026-09-27T12:00:00.000Z",
    }));

    expect(checklistProgress(items).ready).toBe(true);
    expect(
      canFinishCleaning({
        status: "queued",
        items,
        confirmCleaning: true,
        confirmLeft: true,
      }),
    ).toBe(false);
    expect(
      canFinishCleaning({
        status: "in_progress",
        items,
        confirmCleaning: true,
        confirmLeft: false,
      }),
    ).toBe(false);
    expect(
      canFinishCleaning({
        status: "in_progress",
        items,
        confirmCleaning: true,
        confirmLeft: true,
      }),
    ).toBe(true);
  });

  it("derives property readiness from open tasks", () => {
    expect(readinessAfterTasks([])).toBe("ready");
    expect(readinessAfterTasks(["completed", "cancelled"])).toBe("ready");
    expect(readinessAfterTasks(["queued"])).toBe("cleaning_required");
    expect(readinessAfterTasks(["queued", "in_progress"])).toBe("cleaning_in_progress");
  });
});
