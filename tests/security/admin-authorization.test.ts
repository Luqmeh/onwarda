import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthorizationError } from "@/lib/errors";

vi.mock("@/lib/auth/session", () => ({
  requireUser: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/database/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/database/admin", () => ({
  createServiceRoleClient: vi.fn(),
}));

import { requireUser } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/database/admin";
import { createSupabaseServerClient } from "@/lib/database/server";
import { requirePlatformAdmin } from "@/lib/authorization/platform-admin";
import {
  getAdminActivityFeed,
  getAdminDashboardData,
} from "@/lib/admin/dashboard";
import { getAdminOrganization, listAdminOrganizations } from "@/lib/admin/organizations";

function createBuilder(result: unknown) {
  const builder: Record<string, unknown> = {};
  const self = () => builder;
  builder.select = vi.fn(self);
  builder.eq = vi.fn(self);
  builder.or = vi.fn(self);
  builder.order = vi.fn(self);
  builder.limit = vi.fn(self);
  builder.range = vi.fn(self);
  builder.maybeSingle = vi.fn(async () => result);
  builder.then = (
    onFulfilled: (value: unknown) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(onFulfilled, onRejected);
  return builder;
}

function walkSource(dir: string, files: string[] = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walkSource(full, files);
    } else if (full.endsWith(".ts") || full.endsWith(".tsx")) {
      files.push(full);
    }
  }
  return files;
}

describe("platform admin authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("denies an authenticated client user who is not a platform admin", async () => {
    vi.mocked(requireUser).mockResolvedValue({
      id: "client-user",
      email: "owner@example.com",
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      from: vi.fn((table: string) => {
        expect(table).toBe("platform_admins");
        return createBuilder({ data: null, error: null });
      }),
    } as never);

    await expect(requirePlatformAdmin()).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("does not consult organization membership when authorizing platform admins", async () => {
    const from = vi.fn((table: string) =>
      createBuilder(
        table === "platform_admins"
          ? { data: null, error: null }
          : { data: { id: "membership" }, error: null },
      ),
    );

    vi.mocked(requireUser).mockResolvedValue({
      id: "org-owner",
      email: "owner@example.com",
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue({ from } as never);

    await expect(requirePlatformAdmin()).rejects.toBeInstanceOf(AuthorizationError);
    expect(from).toHaveBeenCalledWith("platform_admins");
    expect(from).not.toHaveBeenCalledWith("organization_users");
    expect(from).not.toHaveBeenCalledWith("organizations");
  });

  it("allows only an active platform-admin row", async () => {
    vi.mocked(requireUser).mockResolvedValue({
      id: "admin-user",
      email: "admin@onwarda.com",
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "platform_admins") {
          return createBuilder({
            data: {
              id: "admin-1",
              user_id: "admin-user",
              role: "super_admin",
              status: "active",
              created_at: "2026-01-01T00:00:00.000Z",
              updated_at: "2026-01-01T00:00:00.000Z",
            },
            error: null,
          });
        }

        return createBuilder({
          data: {
            id: "admin-user",
            full_name: "Onwarda Admin",
            email: "admin@onwarda.com",
            avatar_url: null,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
          },
          error: null,
        });
      }),
    } as never);

    const context = await requirePlatformAdmin();
    expect(context.admin.role).toBe("super_admin");
    expect(context.user.email).toBe("admin@onwarda.com");
  });
});

describe("admin data loaders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireUser).mockResolvedValue({
      id: "client-user",
      email: "owner@example.com",
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      from: vi.fn(() => createBuilder({ data: null, error: null })),
    } as never);
  });

  it("does not open a service-role client when platform-admin authorization fails", async () => {
    await expect(getAdminDashboardData()).rejects.toBeInstanceOf(AuthorizationError);
    await expect(getAdminActivityFeed()).rejects.toBeInstanceOf(AuthorizationError);
    await expect(listAdminOrganizations({})).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      getAdminOrganization("11111111-1111-1111-1111-111111111111"),
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect(createServiceRoleClient).not.toHaveBeenCalled();
  });

  it("returns live zero counts for an authorized platform admin", async () => {
    vi.mocked(requireUser).mockResolvedValue({
      id: "admin-user",
      email: "admin@onwarda.com",
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: {
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn(async () => ({
            data: { currentLevel: "aal2", nextLevel: "aal2" },
            error: null,
          })),
          listFactors: vi.fn(async () => ({
            data: { totp: [{ id: "factor-1", status: "verified" }] },
            error: null,
          })),
        },
      },
      from: vi.fn((table: string) => {
        if (table === "platform_admins") {
          return createBuilder({
            data: {
              id: "admin-1",
              user_id: "admin-user",
              role: "super_admin",
              status: "active",
              created_at: "2026-01-01T00:00:00.000Z",
              updated_at: "2026-01-01T00:00:00.000Z",
            },
            error: null,
          });
        }

        if (table === "profiles") {
          return createBuilder({ data: null, error: null });
        }

        return createBuilder({ data: [], error: null });
      }),
    } as never);
    vi.mocked(createServiceRoleClient).mockReturnValue({
      from: vi.fn(() => createBuilder({ data: null, count: 0, error: null })),
    } as never);

    const result = await getAdminDashboardData();

    expect(createServiceRoleClient).toHaveBeenCalledTimes(1);
    expect(result.metrics).toEqual({
      organizations: 0,
      activeOrganizations: 0,
      suspendedOrganizations: 0,
      organizationUsers: 0,
      properties: 0,
      reservations: 0,
      guests: 0,
    });
    expect(result.activity).toEqual([]);
  });
});

describe("admin source isolation", () => {
  const root = join(process.cwd(), "src");

  it("keeps admin, client workspace, guest, and slug authorization separate", () => {
    const adminLayout = readFileSync(
      join(root, "app/admin/(console)/layout.tsx"),
      "utf8",
    );
    const appLayout = readFileSync(join(root, "app/app/layout.tsx"), "utf8");
    const guestPage = readFileSync(join(root, "app/g/[token]/page.tsx"), "utf8");
    const slugPage = readFileSync(join(root, "app/o/[slug]/page.tsx"), "utf8");

    expect(adminLayout).toContain("getPlatformAdminMfaGate");
    expect(adminLayout).not.toContain("requireCurrentOrganization");
    expect(appLayout).toContain("requireCurrentOrganization");
    expect(appLayout).not.toContain("requirePlatformAdmin");
    expect(guestPage).not.toContain("requirePlatformAdmin");
    expect(guestPage).not.toContain("createServiceRoleClient");
    expect(slugPage).not.toContain("requirePlatformAdmin");
    expect(slugPage).not.toContain("createServiceRoleClient");
  });

  it("loads dashboard metrics only after requirePlatformAdmin and without tenant row dumps", () => {
    const dashboard = readFileSync(join(root, "lib/admin/dashboard.ts"), "utf8");
    const requireIndex = dashboard.indexOf("await requireActivePlatformAdminWithMfa()");
    const serviceIndex = dashboard.indexOf("createServiceRoleClient()");

    expect(requireIndex).toBeGreaterThan(-1);
    expect(serviceIndex).toBeGreaterThan(requireIndex);
    expect(dashboard).toContain('{ count: "exact", head: true }');
    expect(dashboard).toContain(
      'select("id, action, actor_type, target_type, created_at")',
    );
    expect(dashboard).not.toContain("metadata");
    expect(dashboard).not.toContain("full_name");
    expect(dashboard).not.toMatch(/select\([^)]*email/);
  });

  it("keeps service-role and server env modules out of client components", () => {
    const clientFiles = walkSource(root).filter((file) => {
      const source = readFileSync(file, "utf8");
      return source.includes('"use client"') || source.includes("'use client'");
    });

    expect(clientFiles.length).toBeGreaterThan(0);

    for (const file of clientFiles) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toContain("@/lib/database/admin");
      expect(source, file).not.toContain("@/config/env.server");
      expect(source, file).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
      expect(source, file).not.toContain("createServiceRoleClient");
    }
  });
});
