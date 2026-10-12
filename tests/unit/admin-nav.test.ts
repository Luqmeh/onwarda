import { describe, expect, it } from "vitest";

import { ADMIN_NAV_ITEMS, ADMIN_ROUTES, isAdminNavActive } from "@/config/admin";
import { toMetricCount } from "@/lib/admin/dashboard";

describe("admin navigation", () => {
  it("defines the Layer 1 admin routes", () => {
    expect(ADMIN_ROUTES).toEqual({
      root: "/admin",
      login: "/admin/login",
      clients: "/admin/clients",
      clientNew: "/admin/clients/new",
      activity: "/admin/activity",
      settings: "/admin/settings",
      mfaSetup: "/admin/security/mfa-setup",
      mfaChallenge: "/admin/security/mfa-challenge",
      accept: "/admin/accept",
    });
  });

  it("keeps dashboard, clients, activity, and settings as distinct sections", () => {
    expect(ADMIN_NAV_ITEMS.map((item) => item.href)).toEqual([
      "/admin",
      "/admin/clients",
      "/admin/activity",
      "/admin/settings",
    ]);
  });

  it("highlights the current section without treating /admin as every child", () => {
    expect(isAdminNavActive("/admin", "/admin", true)).toBe(true);
    expect(isAdminNavActive("/admin/clients", "/admin", true)).toBe(false);
    expect(isAdminNavActive("/admin/clients/new", "/admin/clients", false)).toBe(true);
    expect(isAdminNavActive("/app", "/admin", true)).toBe(false);
  });
});

describe("admin dashboard metrics", () => {
  it("treats a missing count as zero", () => {
    expect(toMetricCount(null)).toBe(0);
    expect(toMetricCount(undefined)).toBe(0);
    expect(toMetricCount(0)).toBe(0);
    expect(toMetricCount(12)).toBe(12);
  });
});
