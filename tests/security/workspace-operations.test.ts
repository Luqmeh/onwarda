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
  createWorkspacePropertyAction,
  createWorkspaceReservationAction,
  updateWorkspacePropertyAction,
  updateWorkspaceReservationStatusAction,
} from "@/lib/workspace/actions";

const emptyForm = { get: () => "" } as unknown as FormData;

describe("workspace operations authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not let staff create or edit properties", async () => {
    vi.mocked(requireOrganizationRole).mockRejectedValue(
      new TenantIsolationError("This action requires a higher organization role."),
    );

    await expect(createWorkspacePropertyAction({}, emptyForm)).resolves.toEqual({
      error: "This action requires a higher organization role.",
    });
    await expect(
      updateWorkspacePropertyAction(
        "11111111-1111-4111-8111-111111111111",
        {},
        emptyForm,
      ),
    ).resolves.toEqual({
      error: "This action requires a higher organization role.",
    });
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("does not let staff create reservations or change stay status", async () => {
    vi.mocked(requireOrganizationRole).mockRejectedValue(
      new TenantIsolationError("This action requires a higher organization role."),
    );

    await expect(createWorkspaceReservationAction({}, emptyForm)).resolves.toEqual({
      error: "This action requires a higher organization role.",
    });
    await expect(
      updateWorkspaceReservationStatusAction(
        "11111111-1111-4111-8111-111111111111",
        {},
        emptyForm,
      ),
    ).resolves.toEqual({
      error: "This action requires a higher organization role.",
    });
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("keeps workspace mutations on the membership organization", () => {
    const actions = readFileSync(
      join(process.cwd(), "src/lib/workspace/actions.ts"),
      "utf8",
    );
    const propertyPage = readFileSync(
      join(process.cwd(), "src/app/app/properties/[propertyId]/page.tsx"),
      "utf8",
    );
    const reservationPage = readFileSync(
      join(process.cwd(), "src/app/app/reservations/[reservationId]/page.tsx"),
      "utf8",
    );
    const guestPage = readFileSync(
      join(process.cwd(), "src/app/app/guests/[guestId]/page.tsx"),
      "utf8",
    );

    expect(actions).toContain("context.organization.id");
    expect(actions).toContain("requireOrganizationRole(ORGANIZATION_ADMIN_ROLES)");
    expect(actions).toContain("requireOrganizationRole(ORGANIZATION_OPERATIONAL_ROLES)");
    expect(actions).not.toContain("createServiceRoleClient");
    expect(actions).not.toContain("requirePlatformAdmin");
    expect(actions).not.toContain('formData.get("organizationId")');
    expect(actions).toContain("guest.created");
    expect(actions).toContain("reservation.status_changed");
    expect(propertyPage).toContain("getWorkspaceProperty");
    expect(reservationPage).toContain("Guest Portal");
    expect(reservationPage).toContain("Not generated yet");
    expect(guestPage).toContain("getWorkspaceGuest");
  });
});
