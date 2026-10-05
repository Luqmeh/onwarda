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

import { requirePlatformAdmin } from "@/lib/authorization/platform-admin";
import { createServiceRoleClient } from "@/lib/database/admin";
import { createSupabaseServerClient } from "@/lib/database/server";
import { provisionOrganization, setOrganizationStatus } from "@/lib/admin/provision";
import { getAdminOrganization } from "@/lib/admin/organizations";

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

const adminContext = {
  user: { id: "admin-user", email: "admin@onwarda.com" },
  profile: null,
  admin: { role: "super_admin", status: "active" },
};

describe("admin provisioning authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not let a non-admin create an organization", async () => {
    vi.mocked(requirePlatformAdmin).mockRejectedValue(new AuthorizationError());

    await expect(
      provisionOrganization({
        name: "Riad Atlas",
        slug: "riad-new",
        ownerEmail: "owner@example.com",
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);

    expect(createServiceRoleClient).not.toHaveBeenCalled();
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("does not let a non-admin change organization status", async () => {
    vi.mocked(requirePlatformAdmin).mockRejectedValue(new AuthorizationError());

    await expect(
      setOrganizationStatus({
        organizationId: randomUUID(),
        status: "suspended",
        confirm: "suspend",
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);

    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("does not let a non-admin invite an organization owner", async () => {
    vi.mocked(requirePlatformAdmin).mockRejectedValue(new AuthorizationError());

    await expect(
      provisionOrganization({
        name: "Riad Atlas",
        slug: "riad-new",
        ownerEmail: "owner@example.com",
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("does not let a non-admin read organization admin detail even with a valid UUID", async () => {
    vi.mocked(requirePlatformAdmin).mockRejectedValue(new AuthorizationError());

    await expect(getAdminOrganization(randomUUID())).rejects.toBeInstanceOf(
      AuthorizationError,
    );
    expect(createServiceRoleClient).not.toHaveBeenCalled();
  });

  it("does not treat an organization UUID as authorization", async () => {
    vi.mocked(requirePlatformAdmin).mockRejectedValue(new AuthorizationError());

    await expect(
      setOrganizationStatus({
        organizationId: randomUUID(),
        status: "active",
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});

describe("admin provisioning workflow", () => {
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
    rpc.mockResolvedValue({ data: "org-1", error: null });
    vi.mocked(createSupabaseServerClient).mockResolvedValue({ rpc } as never);
  });

  it("invites a new owner and provisions through the server RPC", async () => {
    vi.mocked(createServiceRoleClient).mockReturnValue({
      from: vi.fn(() => createBuilder({ data: [], error: null })),
      auth: { admin: { inviteUserByEmail, deleteUser } },
    } as never);

    const result = await provisionOrganization({
      name: "Riad Atlas",
      slug: "riad-new",
      ownerEmail: "owner@example.com",
    });

    expect(inviteUserByEmail).toHaveBeenCalledWith("owner@example.com", {
      redirectTo: "http://localhost:3000/onboarding",
      data: { onwarda_role: "owner" },
    });
    expect(inviteUserByEmail.mock.calls[0]?.[1]).not.toHaveProperty("password");
    expect(rpc).toHaveBeenCalledWith("provision_organization", {
      p_name: "Riad Atlas",
      p_slug: "riad-new",
      p_status: "active",
      p_owner_user_id: "invited-user",
      p_owner_membership_status: "invited",
      p_owner_email: "owner@example.com",
    });
    expect(result).toEqual({
      organizationId: "org-1",
      slug: "riad-new",
      invitationSent: true,
      attachedExistingUser: false,
    });
  });

  it("attaches an existing unused identity instead of creating a duplicate", async () => {
    vi.mocked(createServiceRoleClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          return createBuilder({
            data: [{ id: "existing-user", email: "owner@example.com" }],
            error: null,
          });
        }

        return createBuilder({ data: table === "platform_admins" ? null : [], error: null });
      }),
      auth: { admin: { inviteUserByEmail, deleteUser } },
    } as never);

    const result = await provisionOrganization({
      name: "Riad Atlas",
      slug: "riad-existing",
      ownerEmail: "owner@example.com",
    });

    expect(inviteUserByEmail).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith(
      "provision_organization",
      expect.objectContaining({
        p_owner_user_id: "existing-user",
        p_owner_membership_status: "active",
      }),
    );
    expect(result.attachedExistingUser).toBe(true);
    expect(result.invitationSent).toBe(false);
  });

  it("refuses to attach an email that already belongs to an organization", async () => {
    vi.mocked(createServiceRoleClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          return createBuilder({
            data: [{ id: "busy-user", email: "owner@example.com" }],
            error: null,
          });
        }

        if (table === "organization_users") {
          return createBuilder({ data: [{ id: "membership-1" }], error: null });
        }

        return createBuilder({ data: null, error: null });
      }),
      auth: { admin: { inviteUserByEmail, deleteUser } },
    } as never);

    await expect(
      provisionOrganization({
        name: "Riad Atlas",
        slug: "riad-busy",
        ownerEmail: "owner@example.com",
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(inviteUserByEmail).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("requires explicit confirmation before suspension", async () => {
    await expect(
      setOrganizationStatus({
        organizationId: randomUUID(),
        status: "suspended",
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(rpc).not.toHaveBeenCalled();
  });

  it("activates or suspends only through the status RPC after confirmation", async () => {
    const organizationId = randomUUID();
    await setOrganizationStatus({
      organizationId,
      status: "suspended",
      confirm: "suspend",
    });

    expect(rpc).toHaveBeenCalledWith("set_organization_status", {
      p_organization_id: organizationId,
      p_status: "suspended",
    });
  });
});

describe("admin provisioning source controls", () => {
  it("keeps Auth admin invitation and service-role usage on the server", () => {
    const provision = readFileSync(
      join(process.cwd(), "src/lib/admin/provision.ts"),
      "utf8",
    );
    const workflow = provision.slice(
      provision.indexOf("export async function provisionOrganization("),
    );
    const requireIndex = workflow.indexOf("await requirePlatformAdmin()");
    const inviteIndex = workflow.indexOf("inviteOwner(");
    const rpcIndex = workflow.indexOf('rpc("provision_organization"');

    expect(provision.startsWith('"use server"')).toBe(true);
    expect(provision).toContain("inviteUserByEmail");
    expect(requireIndex).toBeGreaterThan(-1);
    expect(inviteIndex).toBeGreaterThan(requireIndex);
    expect(rpcIndex).toBeGreaterThan(requireIndex);
    expect(provision).not.toMatch(/password\s*:/);
  });
});
