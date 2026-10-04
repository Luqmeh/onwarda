import { describe, expect, it } from "vitest";

import {
  ADMIN_PREFIX,
  CLIENT_ACCESS_PREFIX,
  CLIENT_WORKSPACE_PREFIX,
  GUEST_PORTAL_PREFIX,
  PUBLIC_PORTFOLIO_PREFIX,
  clientAccessPath,
  guestPortalPath,
  publicOperatorPath,
  publicPropertyPath,
} from "@/config/app";

describe("application context routing", () => {
  it("keeps admin, client, and guest paths separate", () => {
    expect(ADMIN_PREFIX).toBe("/admin");
    expect(CLIENT_WORKSPACE_PREFIX).toBe("/app");
    expect(GUEST_PORTAL_PREFIX).toBe("/g");
    expect(CLIENT_ACCESS_PREFIX).toBe("/o");
    expect(PUBLIC_PORTFOLIO_PREFIX).toBe("/p");
    expect(ADMIN_PREFIX).not.toBe("/");
  });

  it("builds slug and token URLs without embedding record ids", () => {
    expect(clientAccessPath("riad-atlas")).toBe("/o/riad-atlas");
    expect(publicOperatorPath("riad-atlas")).toBe("/p/riad-atlas");
    expect(publicPropertyPath("riad-atlas", "riad-suite")).toBe("/p/riad-atlas/riad-suite");
    expect(publicPropertyPath("riad-atlas", "riad-suite")).not.toContain("1111");
    expect(guestPortalPath("opaque-token")).toBe("/g/opaque-token");
    expect(guestPortalPath("opaque-token", "/arrival")).toBe("/g/opaque-token/arrival");
    expect(guestPortalPath("opaque-token")).not.toContain("reservation");
  });
});
