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
  removeWorkspaceBrandingLogoAction,
  updateWorkspaceBrandingAction,
} from "@/lib/workspace/branding-actions";

describe("client branding authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not let staff modify organization branding", async () => {
    vi.mocked(requireOrganizationRole).mockRejectedValue(
      new TenantIsolationError("This action requires a higher organization role."),
    );

    await expect(
      updateWorkspaceBrandingAction(
        {},
        {
          get: () => "",
        } as unknown as FormData,
      ),
    ).resolves.toEqual({
      error: "This action requires a higher organization role.",
    });
    await expect(
      removeWorkspaceBrandingLogoAction(
        {},
        { get: () => "" } as unknown as FormData,
      ),
    ).resolves.toEqual({
      error: "This action requires a higher organization role.",
    });
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("keeps workspace branding updates on the user-scoped client", () => {
    const actions = readFileSync(
      join(process.cwd(), "src/lib/workspace/branding-actions.ts"),
      "utf8",
    );
    const settings = readFileSync(
      join(process.cwd(), "src/app/app/settings/page.tsx"),
      "utf8",
    );

    expect(actions).toContain("requireOrganizationRole(ORGANIZATION_ADMIN_ROLES)");
    expect(actions).toContain("context.organization.id");
    expect(actions).not.toContain("createServiceRoleClient");
    expect(actions).not.toContain("requirePlatformAdmin");
    expect(settings).toContain("WorkspaceBrandingForm");
    expect(settings).not.toContain("updateAdminOrganizationBrandingAction");
  });
});
