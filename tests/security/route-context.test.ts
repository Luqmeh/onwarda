import { describe, expect, it } from "vitest";

import {
  ADMIN_PREFIX,
  CLIENT_ACCESS_PREFIX,
  CLIENT_WORKSPACE_PREFIX,
  GUEST_PORTAL_PREFIX,
  clientAccessPath,
  guestPortalPath,
} from "@/config/app";

describe("application context routing", () => {
  it("keeps admin, client, and guest paths separate", () => {
    expect(ADMIN_PREFIX).toBe("/admin");
    expect(CLIENT_WORKSPACE_PREFIX).toBe("/app");
    expect(GUEST_PORTAL_PREFIX).toBe("/g");
    expect(CLIENT_ACCESS_PREFIX).toBe("/o");
  });

  it("builds slug and token URLs without embedding record ids", () => {
    expect(clientAccessPath("riad-atlas")).toBe("/o/riad-atlas");
    expect(guestPortalPath("opaque-token")).toBe("/g/opaque-token");
    expect(guestPortalPath("opaque-token")).not.toContain("reservation");
  });
});
