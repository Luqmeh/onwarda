import { describe, expect, it } from "vitest";

import {
  ADMIN_PREFIX,
  CLIENT_ACCESS_PREFIX,
  CLIENT_WORKSPACE_PREFIX,
  GUEST_PORTAL_PREFIX,
} from "@/config/app";
import { config, isAdminPath, isClientWorkspacePath } from "@/proxy";

describe("admin route isolation", () => {
  it("does not treat client, guest, or slug paths as admin", () => {
    expect(isAdminPath("/admin")).toBe(true);
    expect(isAdminPath("/admin/clients")).toBe(true);
    expect(isAdminPath("/admin/clients/new")).toBe(true);
    expect(isAdminPath("/admin/activity")).toBe(true);
    expect(isAdminPath("/admin/settings")).toBe(true);
    expect(isAdminPath("/app")).toBe(false);
    expect(isAdminPath("/app/dashboard")).toBe(false);
    expect(isAdminPath("/g/opaque-token")).toBe(false);
    expect(isAdminPath("/o/riad-atlas")).toBe(false);
  });

  it("does not treat admin paths as the client workspace", () => {
    expect(isClientWorkspacePath("/app")).toBe(true);
    expect(isClientWorkspacePath("/admin")).toBe(false);
    expect(isClientWorkspacePath("/admin/clients")).toBe(false);
    expect(isClientWorkspacePath("/g/opaque-token")).toBe(false);
    expect(isClientWorkspacePath("/o/riad-atlas")).toBe(false);
  });

  it("keeps guest and slug routers out of the auth proxy matcher", () => {
    expect(config.matcher).toEqual(["/admin/:path*", "/app/:path*", "/login"]);
    expect(config.matcher.join(" ")).not.toContain(GUEST_PORTAL_PREFIX);
    expect(config.matcher.join(" ")).not.toContain(`${CLIENT_ACCESS_PREFIX}/`);
    expect(ADMIN_PREFIX).not.toBe(CLIENT_WORKSPACE_PREFIX);
  });
});
