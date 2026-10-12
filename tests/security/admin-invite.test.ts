import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/database/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { readAdminInviteIdentity } from "@/lib/auth/admin-invite-actions";
import { createSupabaseServerClient } from "@/lib/database/server";

function clientWith(user: { id: string; email: string } | null, row: unknown) {
  const builder: Record<string, unknown> = {};
  const self = () => builder;
  builder.select = vi.fn(self);
  builder.eq = vi.fn(self);
  builder.maybeSingle = vi.fn(async () => ({ data: row, error: null }));

  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user } })),
    },
    from: vi.fn(() => builder),
  };
}

describe("platform administrator invitation identity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts only the signed-in active super administrator", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      clientWith(
        { id: "admin-user", email: "cofounder@example.com" },
        {
          id: "row",
          user_id: "admin-user",
          role: "super_admin",
          status: "active",
          created_at: "",
          updated_at: "",
        },
      ) as never,
    );

    await expect(readAdminInviteIdentity()).resolves.toEqual({ ok: true });
  });

  it("rejects a signed-in user with no platform-admin row", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      clientWith({ id: "client-user", email: "guest@example.com" }, null) as never,
    );

    await expect(readAdminInviteIdentity()).resolves.toEqual({ ok: false });
  });

  it("rejects a suspended or wrong-role row", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      clientWith(
        { id: "admin-user", email: "cofounder@example.com" },
        {
          id: "row",
          user_id: "admin-user",
          role: "super_admin",
          status: "suspended",
          created_at: "",
          updated_at: "",
        },
      ) as never,
    );

    await expect(readAdminInviteIdentity()).resolves.toEqual({ ok: false });

    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      clientWith(
        { id: "admin-user", email: "cofounder@example.com" },
        {
          id: "row",
          user_id: "admin-user",
          role: "staff",
          status: "active",
          created_at: "",
          updated_at: "",
        },
      ) as never,
    );

    await expect(readAdminInviteIdentity()).resolves.toEqual({ ok: false });
  });

  it("rejects recovery for a user who is not an active platform administrator", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      clientWith({ id: "client-user", email: "guest@example.com" }, null) as never,
    );

    await expect(readAdminInviteIdentity()).resolves.toEqual({ ok: false });
  });

  it("rejects recovery for a suspended administrator", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      clientWith(
        { id: "admin-user", email: "cofounder@example.com" },
        {
          id: "row",
          user_id: "admin-user",
          role: "super_admin",
          status: "suspended",
          created_at: "",
          updated_at: "",
        },
      ) as never,
    );

    await expect(readAdminInviteIdentity()).resolves.toEqual({ ok: false });
  });

  it("rejects an anonymous visitor", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(clientWith(null, null) as never);

    await expect(readAdminInviteIdentity()).resolves.toEqual({ ok: false });
  });
});
