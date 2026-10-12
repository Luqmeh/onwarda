import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthorizationError } from "@/lib/errors";

vi.mock("@/lib/auth/session", () => ({
  requireUser: vi.fn(),
}));

vi.mock("@/lib/database/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/database/server";
import {
  getPlatformAdminMfaGate,
  requireActivePlatformAdminWithMfa,
} from "@/lib/authorization/platform-admin";

const adminRow = {
  id: "admin-1",
  user_id: "admin-user",
  role: "super_admin",
  status: "active",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

function supabaseFor(options: {
  admin?: unknown;
  currentLevel?: "aal1" | "aal2" | null;
  verified?: boolean;
}) {
  return {
    from: vi.fn((table: string) => {
      const result =
        table === "platform_admins"
          ? { data: options.admin ?? null, error: null }
          : {
              data: {
                id: "admin-user",
                full_name: "Admin",
                email: "admin@onwarda.com",
                avatar_url: null,
                created_at: adminRow.created_at,
                updated_at: adminRow.updated_at,
              },
              error: null,
            };
      const builder: Record<string, unknown> = {};
      const self = () => builder;
      builder.select = vi.fn(self);
      builder.eq = vi.fn(self);
      builder.maybeSingle = vi.fn(async () => result);
      return builder;
    }),
    auth: {
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn(async () => ({
          data: { currentLevel: options.currentLevel ?? "aal1", nextLevel: "aal2" },
          error: null,
        })),
        listFactors: vi.fn(async () => ({
          data: {
            totp: options.verified
              ? [{ id: "factor-1", status: "verified", factor_type: "totp" }]
              : [],
          },
          error: null,
        })),
      },
    },
  };
}

describe("platform admin MFA gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireUser).mockResolvedValue({
      id: "admin-user",
      email: "admin@onwarda.com",
    });
  });

  it("denies an authenticated user who is not a platform administrator", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(supabaseFor({}) as never);

    await expect(requireActivePlatformAdminWithMfa()).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("blocks an active administrator whose session is only aal1", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      supabaseFor({ admin: adminRow, currentLevel: "aal1", verified: true }) as never,
    );

    await expect(requireActivePlatformAdminWithMfa()).rejects.toThrow(
      /Multi-factor authentication is required/,
    );
    expect(await getPlatformAdminMfaGate()).toMatchObject({ status: "challenge" });
  });

  it("sends an administrator with no verified factor to enrollment", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      supabaseFor({ admin: adminRow, currentLevel: "aal1", verified: false }) as never,
    );

    expect(await getPlatformAdminMfaGate()).toMatchObject({ status: "enroll" });
  });

  it("allows an active administrator only after the session is aal2", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      supabaseFor({ admin: adminRow, currentLevel: "aal2", verified: true }) as never,
    );

    const context = await requireActivePlatformAdminWithMfa();
    expect(context.admin.role).toBe("super_admin");
  });
});
