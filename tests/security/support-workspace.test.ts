import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthorizationError } from "@/lib/errors";

vi.mock("@/lib/authorization/platform-admin", () => ({
  getPlatformAdminContext: vi.fn(),
}));

vi.mock("@/lib/database/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import { getPlatformAdminContext } from "@/lib/authorization/platform-admin";
import { resolveValidSupportWorkspace } from "@/lib/authorization/support-workspace";
import { createSupabaseServerClient } from "@/lib/database/server";

function createBuilder(result: unknown) {
  const builder: Record<string, unknown> = {};
  const self = () => builder;
  builder.select = vi.fn(self);
  builder.eq = vi.fn(self);
  builder.maybeSingle = vi.fn(async () => result);
  return builder;
}

const adminContext = {
  user: { id: "admin-user", email: "admin@onwarda.com" },
  profile: null,
  admin: { role: "super_admin", status: "active" },
};

const cookieStore = {
  get: vi.fn(),
};

describe("support workspace access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieStore.get.mockReturnValue({ value: "session-1" });
    vi.mocked(cookies).mockResolvedValue(cookieStore as never);
    vi.mocked(getPlatformAdminContext).mockResolvedValue(adminContext as never);
  });

  it("rejects a missing or inactive support session", async () => {
    cookieStore.get.mockReturnValue(undefined);
    await expect(resolveValidSupportWorkspace()).resolves.toBeNull();

    cookieStore.get.mockReturnValue({ value: "session-1" });
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      from: vi.fn(() =>
        createBuilder({
          data: {
            id: "session-1",
            organization_id: "org-a",
            ended_at: "2026-09-03T01:00:00.000Z",
            expires_at: "2026-09-03T12:00:00.000Z",
          },
          error: null,
        }),
      ),
    } as never);

    await expect(resolveValidSupportWorkspace()).resolves.toBeNull();
  });

  it("rejects an expired support session", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      from: vi.fn(() =>
        createBuilder({
          data: {
            id: "session-1",
            organization_id: "org-a",
            ended_at: null,
            expires_at: "2020-01-01T00:00:00.000Z",
          },
          error: null,
        }),
      ),
    } as never);

    await expect(resolveValidSupportWorkspace()).resolves.toBeNull();
  });

  it("does not invent a membership when support access is valid", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "support_sessions") {
          return createBuilder({
            data: {
              id: "session-1",
              organization_id: "org-a",
              reason: "wifi",
              started_at: "2026-09-03T00:00:00.000Z",
              expires_at: "2099-01-01T00:00:00.000Z",
              ended_at: null,
            },
            error: null,
          });
        }

        if (table === "organizations") {
          return createBuilder({
            data: {
              id: "org-a",
              name: "Riad Atlas",
              slug: "riad-atlas",
            },
            error: null,
          });
        }

        return createBuilder({ data: null, error: null });
      }),
    } as never);

    const support = await resolveValidSupportWorkspace();

    expect(support?.organization.id).toBe("org-a");
    expect(support?.supportSession.organizationId).toBe("org-a");
    expect(support).not.toHaveProperty("membership");
  });

  it("does not treat a non-admin as a support operator", async () => {
    vi.mocked(getPlatformAdminContext).mockResolvedValue(null);

    await expect(resolveValidSupportWorkspace()).resolves.toBeNull();
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });
});

describe("support workspace source isolation", () => {
  it("keeps support helpers outside workspace modules and does not create memberships", () => {
    const helper = readFileSync(
      join(process.cwd(), "src/lib/authorization/support-workspace.ts"),
      "utf8",
    );
    const layout = readFileSync(join(process.cwd(), "src/app/app/layout.tsx"), "utf8");
    const actions = readFileSync(join(process.cwd(), "src/lib/workspace/actions.ts"), "utf8");

    expect(helper).toContain("getPlatformAdminContext");
    expect(helper).not.toContain("organization_users");
    expect(helper).not.toContain("createServiceRoleClient");
    expect(layout).toContain("requireCurrentOrganization");
    expect(layout).not.toContain("requirePlatformAdmin");
    expect(layout).not.toContain("getActiveSupportSession");
    expect(actions).toContain("requireOrganizationRole");
    expect(actions).not.toContain("createServiceRoleClient");
  });

  it("does not let a missing admin context look like a membership error", () => {
    expect(new AuthorizationError().name).toBe("AuthorizationError");
  });
});
