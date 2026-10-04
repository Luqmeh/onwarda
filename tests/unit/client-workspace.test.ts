import { describe, expect, it } from "vitest";

import {
  CLIENT_ROUTES,
  canManagePropertyCms,
  canManageStays,
  canManageBilling,
  canManageWorkspace,
  canViewBilling,
  clientGuestPath,
  clientNavItemsForRole,
  clientPropertyPath,
  clientReservationPath,
  isClientNavActive,
} from "@/config/client";
import { resolveOrganizationBranding } from "@/lib/workspace/branding";
import { ONWARDA_COLOR_TOKENS } from "@/config/brand";

describe("client workspace navigation", () => {
  it("keeps client routes under /app and away from admin", () => {
    expect(CLIENT_ROUTES.root).toBe("/app");
    expect(CLIENT_ROUTES.properties).toBe("/app/properties");
    expect(CLIENT_ROUTES.reservationNew).toBe("/app/reservations/new");
    expect(CLIENT_ROUTES.settings).toBe("/app/settings");
    expect(CLIENT_ROUTES.billing).toBe("/app/billing");
    expect(clientPropertyPath("11111111-1111-4111-8111-111111111111")).toBe(
      "/app/properties/11111111-1111-4111-8111-111111111111",
    );
    expect(clientReservationPath("11111111-1111-4111-8111-111111111111")).toBe(
      "/app/reservations/11111111-1111-4111-8111-111111111111",
    );
    expect(clientGuestPath("11111111-1111-4111-8111-111111111111")).toBe(
      "/app/guests/11111111-1111-4111-8111-111111111111",
    );
    expect(CLIENT_ROUTES.root).not.toContain("/admin");
  });

  it("hides settings from staff while leaving operational pages visible", () => {
    const staff = clientNavItemsForRole("staff").map((item) => item.label);
    const owner = clientNavItemsForRole("owner").map((item) => item.label);

    expect(staff).toContain("Overview");
    expect(staff).toContain("Issues");
    expect(staff).toContain("Cleaning");
    expect(staff).not.toContain("Settings");
    expect(staff).not.toContain("Billing");
    expect(owner).toContain("Settings");
    expect(owner).toContain("Billing");
    expect(clientNavItemsForRole("manager").map((item) => item.label)).toContain("Billing");
    expect(canViewBilling("manager")).toBe(true);
    expect(canViewBilling("staff")).toBe(false);
    expect(canManageBilling("staff")).toBe(false);
    expect(canManageBilling("manager")).toBe(false);
    expect(canManageBilling("owner")).toBe(true);
    expect(canManageWorkspace("staff")).toBe(false);
    expect(canManageWorkspace("owner")).toBe(true);
    expect(canManageWorkspace("admin")).toBe(true);
    expect(canManageStays("staff")).toBe(false);
    expect(canManageStays("manager")).toBe(true);
    expect(canManageStays("owner")).toBe(true);
    expect(canManagePropertyCms("staff")).toBe(false);
    expect(canManagePropertyCms("manager")).toBe(true);
    expect(canManagePropertyCms("owner")).toBe(true);
  });

  it("highlights nested property routes without selecting overview", () => {
    expect(isClientNavActive("/app", "/app", true)).toBe(true);
    expect(isClientNavActive("/app/properties", "/app", true)).toBe(false);
    expect(isClientNavActive("/app/properties/new", "/app/properties", false)).toBe(
      true,
    );
  });
});

describe("organization branding defaults", () => {
  it("falls back to the organization name and Onwarda colors", () => {
    const branding = resolveOrganizationBranding({
      organizationId: "11111111-1111-4111-8111-111111111111",
      organizationName: "Riad Atlas",
      branding: null,
    });

    expect(branding.displayName).toBe("Riad Atlas");
    expect(branding.accentColor).toBe(ONWARDA_COLOR_TOKENS.coral);
    expect(branding.primaryColor).toBe(ONWARDA_COLOR_TOKENS.olive);
  });

  it("uses a valid organization accent color when provided", () => {
    const branding = resolveOrganizationBranding({
      organizationId: "11111111-1111-4111-8111-111111111111",
      organizationName: "Riad Atlas",
      branding: {
        display_name: "Riad Atlas",
        public_description: null,
        logo_path: null,
        primary_color: "#77764F",
        secondary_color: null,
        accent_color: "#DD817A",
      },
    });

    expect(branding.accentColor).toBe("#dd817a");
    expect(branding.primaryColor).toBe("#77764f");
  });
});
