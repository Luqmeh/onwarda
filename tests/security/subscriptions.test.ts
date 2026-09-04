import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthorizationError } from "@/lib/errors";

vi.mock("@/lib/authorization/platform-admin", () => ({
  requirePlatformAdmin: vi.fn(),
}));

vi.mock("@/lib/database/admin", () => ({
  createServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/database/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { requirePlatformAdmin } from "@/lib/authorization/platform-admin";
import { createServiceRoleClient } from "@/lib/database/admin";
import {
  getOrganizationSubscription,
  setOrganizationSubscriptionAction,
} from "@/lib/admin/subscriptions";

describe("subscription administration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires a platform admin before reading or changing a subscription", async () => {
    vi.mocked(requirePlatformAdmin).mockRejectedValue(new AuthorizationError());

    await expect(getOrganizationSubscription(randomUUID())).rejects.toBeInstanceOf(
      AuthorizationError,
    );
    await expect(
      setOrganizationSubscriptionAction(
        {},
        {
          get: (name: string) =>
            name === "organizationId" ? randomUUID() : name === "plan" ? "starter" : "",
        } as FormData,
      ),
    ).resolves.toEqual({ error: "Platform administrator access is required." });
    expect(createServiceRoleClient).not.toHaveBeenCalled();
  });

  it("keeps subscription mutations behind an audited admin RPC", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/admin/subscriptions.ts"),
      "utf8",
    );
    const settings = readFileSync(
      join(process.cwd(), "src/app/app/settings/page.tsx"),
      "utf8",
    );

    expect(source).toContain("await requirePlatformAdmin()");
    expect(source).toContain('rpc("admin_set_organization_subscription"');
    expect(settings).not.toContain("setOrganizationSubscriptionAction");
    expect(settings).not.toContain("admin_set_organization_subscription");
  });
});
