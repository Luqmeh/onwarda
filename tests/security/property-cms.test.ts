import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { TenantIsolationError } from "@/lib/errors";

vi.mock("@/lib/tenancy/context", () => ({
  requireOrganizationRole: vi.fn(),
}));

vi.mock("@/lib/database/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { requireOrganizationRole } from "@/lib/tenancy/context";
import { createSupabaseServerClient } from "@/lib/database/server";
import {
  updatePropertyAmenitiesAction,
  uploadPropertyImageAction,
} from "@/lib/workspace/property-cms-actions";

const emptyForm = { get: () => "", getAll: () => [] } as unknown as FormData;

describe("property CMS authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not let staff mutate CMS content", async () => {
    vi.mocked(requireOrganizationRole).mockRejectedValue(
      new TenantIsolationError("This action requires a higher organization role."),
    );

    await expect(
      updatePropertyAmenitiesAction("11111111-1111-4111-8111-111111111111", {}, emptyForm),
    ).resolves.toEqual({
      error: "This action requires a higher organization role.",
    });
    await expect(
      uploadPropertyImageAction("11111111-1111-4111-8111-111111111111", {}, emptyForm),
    ).resolves.toEqual({
      error: "This action requires a higher organization role.",
    });
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("keeps CMS mutations on the membership organization without service role", () => {
    const actions = readFileSync(
      join(process.cwd(), "src/lib/workspace/property-cms-actions.ts"),
      "utf8",
    );
    const page = readFileSync(
      join(process.cwd(), "src/app/app/properties/[propertyId]/page.tsx"),
      "utf8",
    );

    expect(actions).toContain("context.organization.id");
    expect(actions).toContain("requireOrganizationRole(ORGANIZATION_OPERATIONAL_ROLES)");
    expect(actions).not.toContain("createServiceRoleClient");
    expect(actions).not.toContain("requirePlatformAdmin");
    expect(actions).not.toContain('formData.get("organizationId")');
    expect(page).toContain("getWorkspaceProperty");
    expect(page).toContain("messages.screens.propertyCms");
    expect(page).toContain("canManagePropertyCms");
  });
});
