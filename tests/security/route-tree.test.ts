import { describe, expect, it } from "vitest";

import { ADMIN_NAV_ITEMS, ADMIN_ROUTES } from "@/config/admin";
import { CLIENT_NAV_ITEMS, CLIENT_ROUTES } from "@/config/client";
import { MARKETING_NAV, MARKETING_ROUTES } from "@/config/marketing";

import {
  REQUIRED_DYNAMIC_ROUTES,
  REQUIRED_STATIC_ROUTES,
  listAppPageRoutes,
  listCatchAllRoutes,
} from "../helpers/app-route-tree";

describe("application route tree", () => {
  const routes = listAppPageRoutes();

  it("keeps every required static and dynamic page on disk", () => {
    expect(listCatchAllRoutes()).toEqual([]);

    for (const route of [...REQUIRED_STATIC_ROUTES, ...REQUIRED_DYNAMIC_ROUTES]) {
      expect(routes, route).toContain(route);
    }
  });

  it("resolves marketing, admin, and workspace navigation to real pages", () => {
    const configured = [
      ...Object.values(MARKETING_ROUTES),
      ...MARKETING_NAV.map((item) => item.href),
      ...Object.values(ADMIN_ROUTES),
      ...ADMIN_NAV_ITEMS.map((item) => item.href),
      ...Object.values(CLIENT_ROUTES),
      ...CLIENT_NAV_ITEMS.map((item) => item.href),
    ];

    for (const href of configured) {
      expect(routes, href).toContain(href);
    }
  });
});
