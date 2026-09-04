import { describe, expect, it } from "vitest";

import { organizationIdFromStoragePath } from "@/lib/storage/paths";

describe("storage path tenant parsing", () => {
  it("extracts the organization UUID from a canonical path", () => {
    expect(
      organizationIdFromStoragePath(
        "organizations/11111111-1111-4111-8111-111111111111/logo.png",
      ),
    ).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("rejects paths that do not start with organizations/", () => {
    expect(organizationIdFromStoragePath("public/logo.png")).toBeNull();
    expect(
      organizationIdFromStoragePath(
        "../organizations/11111111-1111-4111-8111-111111111111/logo.png",
      ),
    ).toBeNull();
  });

  it("rejects non-UUID folder names", () => {
    expect(
      organizationIdFromStoragePath("organizations/riad-atlas/logo.png"),
    ).toBeNull();
  });
});
