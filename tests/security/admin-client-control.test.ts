import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthorizationError, ValidationError } from "@/lib/errors";

vi.mock("@/lib/authorization/platform-admin", () => ({
  requirePlatformAdmin: vi.fn(),
}));

vi.mock("@/lib/database/admin", () => ({
  createServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/database/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import { requirePlatformAdmin } from "@/lib/authorization/platform-admin";
import { createServiceRoleClient } from "@/lib/database/admin";
import { createSupabaseServerClient } from "@/lib/database/server";
import {
  inviteOrganizationUser,
  setOrganizationUserRole,
  setOrganizationUserStatus,
  transferOrganizationOwnership,
} from "@/lib/admin/members";
import {
  endSupportSession,
  getActiveSupportSession,
  startSupportSession,
} from "@/lib/admin/support";

function createBuilder(result: unknown) {
  const builder: Record<string, unknown> = {};
  const self = () => builder;
  builder.select = vi.fn(self);
  builder.eq = vi.fn(self);
  builder.in = vi.fn(self);
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

const adminContext = {
  user: { id: "admin-user", email: "admin@onwarda.com" },
  profile: null,
  admin: { role: "super_admin", status: "active" },
};

const cookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

describe("admin client membership authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not let a non-admin invite, change roles, or suspend members", async () => {
    vi.mocked(requirePlatformAdmin).mockRejectedValue(new AuthorizationError());
    const organizationId = randomUUID();
    const userId = randomUUID();

    await expect(
      inviteOrganizationUser({
        organizationId,
        email: "staff@example.com",
        role: "staff",
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      setOrganizationUserRole({
        organizationId,
        userId,
        role: "manager",
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      setOrganizationUserStatus({
        organizationId,
        userId,
        status: "suspended",
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      transferOrganizationOwnership({
        organizationId,
        userId,
        confirm: "transfer",
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);

    expect(createServiceRoleClient).not.toHaveBeenCalled();
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("does not treat an organization UUID as authorization for membership changes", async () => {
    vi.mocked(requirePlatformAdmin).mockRejectedValue(new AuthorizationError());

    await expect(
      setOrganizationUserRole({
        organizationId: randomUUID(),
        userId: randomUUID(),
        role: "admin",
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});

describe("admin client membership workflow", () => {
  const inviteUserByEmail = vi.fn();
  const deleteUser = vi.fn();
  const rpc = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requirePlatformAdmin).mockResolvedValue(adminContext as never);
    inviteUserByEmail.mockResolvedValue({
      data: { user: { id: "invited-user" } },
      error: null,
    });
    deleteUser.mockResolvedValue({ error: null });
    rpc.mockResolvedValue({ data: "membership-1", error: null });
    vi.mocked(createSupabaseServerClient).mockResolvedValue({ rpc } as never);
  });

  it("invites a user through Auth Admin and the membership RPC", async () => {
    vi.mocked(createServiceRoleClient).mockReturnValue({
      from: vi.fn(() => createBuilder({ data: [], error: null })),
      auth: { admin: { inviteUserByEmail, deleteUser } },
    } as never);

    const organizationId = randomUUID();
    const result = await inviteOrganizationUser({
      organizationId,
      email: "manager@example.com",
      role: "manager",
    });

    expect(inviteUserByEmail).toHaveBeenCalledWith("manager@example.com", {
      redirectTo: "http://localhost:3000/onboarding",
      data: { onwarda_role: "manager" },
    });
    expect(rpc).toHaveBeenCalledWith("admin_invite_organization_user", {
      p_organization_id: organizationId,
      p_user_id: "invited-user",
      p_email: "manager@example.com",
      p_role: "manager",
      p_membership_status: "invited",
    });
    expect(result.invitationSent).toBe(true);
  });

  it("refuses to invite a platform administrator", async () => {
    vi.mocked(createServiceRoleClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          return createBuilder({
            data: [{ id: "admin-identity", email: "admin@example.com" }],
            error: null,
          });
        }

        if (table === "platform_admins") {
          return createBuilder({ data: { id: "admin-row" }, error: null });
        }

        return createBuilder({ data: [], error: null });
      }),
      auth: { admin: { inviteUserByEmail, deleteUser } },
    } as never);

    await expect(
      inviteOrganizationUser({
        organizationId: randomUUID(),
        email: "admin@example.com",
        role: "staff",
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(inviteUserByEmail).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("support session authorization", () => {
  const rpc = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    cookieStore.get.mockReturnValue(undefined);
    vi.mocked(cookies).mockResolvedValue(cookieStore as never);
    vi.mocked(createSupabaseServerClient).mockResolvedValue({ rpc } as never);
  });

  it("does not start or end support mode without a platform admin", async () => {
    vi.mocked(requirePlatformAdmin).mockRejectedValue(new AuthorizationError());

    await expect(
      startSupportSession({
        organizationId: randomUUID(),
        reason: "Investigate wifi reports",
        confirm: "support",
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(endSupportSession(randomUUID())).rejects.toBeInstanceOf(
      AuthorizationError,
    );
    await expect(getActiveSupportSession()).rejects.toBeInstanceOf(
      AuthorizationError,
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it("requires confirmation and a reason before starting support mode", async () => {
    vi.mocked(requirePlatformAdmin).mockResolvedValue(adminContext as never);

    await expect(
      startSupportSession({
        organizationId: randomUUID(),
        reason: "ok",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("starts a support session through the RPC and stores only the session id cookie", async () => {
    vi.mocked(requirePlatformAdmin).mockResolvedValue(adminContext as never);
    const organizationId = randomUUID();
    const sessionId = randomUUID();
    rpc.mockResolvedValue({ data: sessionId, error: null });
    vi.mocked(createServiceRoleClient).mockReturnValue({
      from: vi.fn(() =>
        createBuilder({
          data: {
            id: sessionId,
            expires_at: "2026-09-03T12:00:00.000Z",
          },
          error: null,
        }),
      ),
    } as never);

    await startSupportSession({
      organizationId,
      reason: "Guest cannot complete check-in",
      confirm: "support",
    });

    expect(rpc).toHaveBeenCalledWith("start_support_session", {
      p_organization_id: organizationId,
      p_reason: "Guest cannot complete check-in",
      p_duration_minutes: 120,
    });
    expect(cookieStore.set).toHaveBeenCalledWith(
      "onwarda_support_session",
      sessionId,
      expect.objectContaining({ httpOnly: true, sameSite: "lax" }),
    );
  });

  it("ignores an expired support session cookie", async () => {
    vi.mocked(requirePlatformAdmin).mockResolvedValue(adminContext as never);
    cookieStore.get.mockReturnValue({ value: "session-1" });
    vi.mocked(createServiceRoleClient).mockReturnValue({
      from: vi.fn(() =>
        createBuilder({
          data: {
            id: "session-1",
            organization_id: "org-1",
            reason: "debug",
            started_at: "2026-09-03T00:00:00.000Z",
            expires_at: "2026-09-03T00:01:00.000Z",
            ended_at: null,
            organizations: { name: "Riad Atlas", slug: "riad-atlas" },
          },
          error: null,
        }),
      ),
    } as never);

    await expect(getActiveSupportSession()).resolves.toBeNull();
  });
});

describe("admin client control source safety", () => {
  it("keeps membership and support mutations behind requirePlatformAdmin", () => {
    const members = readFileSync(join(process.cwd(), "src/lib/admin/members.ts"), "utf8");
    const support = readFileSync(join(process.cwd(), "src/lib/admin/support.ts"), "utf8");
    const appLayout = readFileSync(join(process.cwd(), "src/app/app/layout.tsx"), "utf8");

    expect(members.indexOf("await requirePlatformAdmin()")).toBeGreaterThan(-1);
    expect(members.indexOf('rpc("admin_invite_organization_user"')).toBeGreaterThan(
      members.indexOf("await requirePlatformAdmin()"),
    );
    expect(support).toContain("SUPPORT_SESSION_COOKIE");
    expect(support).not.toContain("organization_users");
    expect(appLayout).not.toContain("getActiveSupportSession");
    expect(appLayout).not.toContain("requirePlatformAdmin");
  });
});
