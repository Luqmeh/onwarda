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
  getAdminOrganizationBranding,
  removeAdminOrganizationLogo,
  updateAdminOrganizationBranding,
  updateAdminOrganizationBrandingAction,
} from "@/lib/admin/branding";

describe("admin branding authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires a platform admin before reading or changing branding", async () => {
    vi.mocked(requirePlatformAdmin).mockRejectedValue(new AuthorizationError());

    await expect(getAdminOrganizationBranding(randomUUID())).rejects.toBeInstanceOf(
      AuthorizationError,
    );
    await expect(
      updateAdminOrganizationBranding({
        organizationId: randomUUID(),
        displayName: "Riad Atlas",
        primaryColor: "#123456",
        secondaryColor: null,
        accentColor: null,
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(removeAdminOrganizationLogo(randomUUID())).rejects.toBeInstanceOf(
      AuthorizationError,
    );
    await expect(
      updateAdminOrganizationBrandingAction(
        randomUUID(),
        {},
        {
          get: () => "",
        } as unknown as FormData,
      ),
    ).resolves.toEqual({ error: "Platform administrator access is required." });
    expect(createServiceRoleClient).not.toHaveBeenCalled();
  });

  it("keeps admin branding mutations behind requirePlatformAdmin and audited RPCs", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/admin/branding.ts"),
      "utf8",
    );
    const workspaceActions = readFileSync(
      join(process.cwd(), "src/lib/workspace/branding-actions.ts"),
      "utf8",
    );

    expect(source.indexOf("await requirePlatformAdmin()")).toBeGreaterThan(-1);
    expect(source.indexOf("createServiceRoleClient()")).toBeGreaterThan(
      source.indexOf("await requirePlatformAdmin()"),
    );
    expect(source).toContain('rpc("admin_set_organization_branding"');
    expect(source).toContain('rpc("admin_set_organization_branding_logo"');
    expect(workspaceActions).not.toContain("requirePlatformAdmin");
    expect(workspaceActions).not.toContain("createServiceRoleClient");
    expect(workspaceActions).not.toContain('formData.get("organizationId")');
  });
});
