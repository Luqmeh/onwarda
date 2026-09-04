import { describe, expect, it } from "vitest";

import { TenantIsolationError } from "@/lib/errors";
import {
  assertSameOrganization,
  resolveTrustedOrganizationId,
} from "@/lib/tenancy/assert";

describe("tenant isolation", () => {
  it("allows a user to access their own organization", () => {
    expect(() =>
      assertSameOrganization("org-a", "org-a"),
    ).not.toThrow();
  });

  it("prevents organization A from accessing organization B", () => {
    expect(() => assertSameOrganization("org-a", "org-b")).toThrow(
      TenantIsolationError,
    );
  });

  it("never trusts a client-supplied foreign organization id", () => {
    expect(() => resolveTrustedOrganizationId("org-a", "org-b")).toThrow(
      TenantIsolationError,
    );
  });

  it("uses the membership organization when no client id is supplied", () => {
    expect(resolveTrustedOrganizationId("org-a")).toBe("org-a");
  });
});
