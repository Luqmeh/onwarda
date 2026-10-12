import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthorizationError } from "@/lib/errors";

vi.mock("@/lib/authorization/platform-admin", () => ({
  requireActivePlatformAdminWithMfa: vi.fn(),
}));

vi.mock("@/lib/database/admin", () => ({
  createServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/database/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { requireActivePlatformAdminWithMfa } from "@/lib/authorization/platform-admin";
import { createServiceRoleClient } from "@/lib/database/admin";
import { createSupabaseServerClient } from "@/lib/database/server";
import { permanentlyDeleteOrganization } from "@/lib/admin/offboarding";

const organizationId = randomUUID();
const exclusiveUserId = randomUUID();
const adminUserId = randomUUID();

function query(result: unknown) {
  const builder: Record<string, unknown> = {};
  const self = () => builder;
  for (const method of ["select", "eq", "is", "insert", "update", "order"]) {
    builder[method] = vi.fn(self);
  }
  builder.maybeSingle = vi.fn(async () => result);
  builder.single = vi.fn(async () => result);
  builder.then = (
    onFulfilled: (value: unknown) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(onFulfilled, onRejected);
  return builder;
}

function preview(eligibleUserIds: string[]) {
  return {
    status: "ok",
    eligibleUserIds,
    auth: {
      eligible: eligibleUserIds.length,
      shared: eligibleUserIds.length === 0 ? 1 : 0,
      platformAdmins: 0,
      review: 0,
    },
    counts: { organizations: 1, storageObjects: 0 },
    preservedShared: ["amenity_definitions"],
  };
}

function installClients(options?: { storageError?: boolean; eligibleUserIds?: string[] }) {
  const deleteUser = vi.fn(async () => ({ error: null }));
  const purge = vi.fn(async () => ({ data: { status: "removed" }, error: null }));
  const block = vi.fn(async () => ({ data: null, error: null }));
  let jobReads = 0;
  const job = {
    id: randomUUID(),
    organization_id: organizationId,
    actor_user_id: adminUserId,
    phase: "blocked",
    storage_removed: false,
    database_removed: false,
    auth_removed: false,
    auth_user_ids: options?.eligibleUserIds ?? [],
    storage_error: null,
    database_error: null,
    auth_error: null,
    completed_at: null,
  };

  vi.mocked(createServiceRoleClient).mockReturnValue({
    from(table: string) {
      if (table === "organizations") {
        return query({
          data: { id: organizationId, slug: "riad-atlas", status: "active" },
          error: null,
        });
      }

      jobReads += 1;
      if (jobReads === 1) {
        return query({ data: null, error: null });
      }

      return query({ data: job, error: null });
    },
    rpc: vi.fn(async (name: string) => {
      if (name === "admin_organization_deletion_preview") {
        return { data: preview(options?.eligibleUserIds ?? [exclusiveUserId]), error: null };
      }
      if (name === "admin_block_organization_for_deletion") {
        return block();
      }
      if (name === "admin_purge_organization_data") {
        return purge();
      }
      return { data: null, error: { message: "unexpected rpc" } };
    }),
    storage: {
      from: () => ({
        list: vi.fn(async () =>
          options?.storageError
            ? { data: null, error: { message: "storage unavailable" } }
            : { data: [], error: null },
        ),
        remove: vi.fn(async () => ({ error: null })),
      }),
    },
    auth: { admin: { deleteUser } },
  } as unknown as ReturnType<typeof createServiceRoleClient>);

  vi.mocked(createSupabaseServerClient).mockResolvedValue({
    rpc: vi.fn(async () => ({ error: null })),
  } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

  return { deleteUser, purge, block };
}

describe("permanent client deletion authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireActivePlatformAdminWithMfa).mockResolvedValue({
      user: { id: adminUserId, email: "admin@onwarda.com" },
      profile: null,
      admin: { role: "super_admin", status: "active" },
    } as Awaited<ReturnType<typeof requireActivePlatformAdminWithMfa>>);
  });

  it("does not let a non-admin start deletion", async () => {
    vi.mocked(requireActivePlatformAdminWithMfa).mockRejectedValue(new AuthorizationError());

    await expect(
      permanentlyDeleteOrganization({
        organizationId,
        confirmation: "riad-atlas",
        acknowledge: true,
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);

    expect(createServiceRoleClient).not.toHaveBeenCalled();
  });

  it("refuses a confirmation that does not match the organization slug", async () => {
    const { purge, deleteUser } = installClients();

    await expect(
      permanentlyDeleteOrganization({
        organizationId,
        confirmation: "other-client",
        acknowledge: true,
      }),
    ).rejects.toThrow(/does not match/);

    expect(purge).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("requires the permanent-deletion acknowledgement", async () => {
    const { purge } = installClients();

    await expect(
      permanentlyDeleteOrganization({
        organizationId,
        confirmation: "riad-atlas",
        acknowledge: false,
      }),
    ).rejects.toThrow(/permanent/);

    expect(purge).not.toHaveBeenCalled();
  });

  it("deletes only exclusive accounts returned by the server preview", async () => {
    const { deleteUser, purge } = installClients({ eligibleUserIds: [exclusiveUserId] });

    const result = await permanentlyDeleteOrganization({
      organizationId,
      confirmation: "riad-atlas",
      acknowledge: true,
    });

    expect(result).toEqual({ status: "complete" });
    expect(purge).toHaveBeenCalledOnce();
    expect(deleteUser).toHaveBeenCalledTimes(1);
    expect(deleteUser).toHaveBeenCalledWith(exclusiveUserId);
  });

  it("does not delete Auth accounts when none are exclusive to the organization", async () => {
    const { deleteUser, purge } = installClients({ eligibleUserIds: [] });

    await permanentlyDeleteOrganization({
      organizationId,
      confirmation: "riad-atlas",
      acknowledge: true,
    });

    expect(purge).toHaveBeenCalledOnce();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("does not purge the database when storage cleanup fails", async () => {
    const { purge, deleteUser } = installClients({ storageError: true });

    const result = await permanentlyDeleteOrganization({
      organizationId,
      confirmation: "riad-atlas",
      acknowledge: true,
    });

    expect(purge).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      incomplete: { storageRemoved: false, databaseRemoved: false },
    });
  });
});

describe("offboarding schema safety", () => {
  const sql = readFileSync(
    join(process.cwd(), "supabase/migrations/20261011020000_client_offboarding.sql"),
    "utf8",
  );

  it("does not grant destructive functions to anon or authenticated users", () => {
    expect(sql).toContain(
      "revoke all on function public.admin_purge_organization_data(uuid, uuid)\n  from public, anon, authenticated;",
    );
    expect(sql).toContain(
      "grant execute on function public.admin_purge_organization_data(uuid, uuid)\n  to service_role;",
    );
    expect(sql).not.toMatch(/grant execute on function public\.admin_purge_organization_data[\s\S]*to anon/);
    expect(sql).not.toMatch(/grant execute on function public\.admin_purge_organization_data[\s\S]*to authenticated/);
    expect(sql).not.toMatch(/delete from public\.amenity_definitions/i);
    expect(sql).not.toMatch(/delete from public\.house_rule_definitions/i);
    expect(sql).not.toMatch(/delete from public\.cleaning_checklist_definitions/i);
    expect(sql).not.toMatch(/delete from auth\.users/i);
    expect(sql).toContain("platform_admins");
  });
});
