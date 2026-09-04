import { describe, expect, it } from "vitest";

import { AuthorizationError } from "@/lib/errors";
import { assertGuestPortalAccess } from "@/lib/guest-portal/access";
import { generateGuestPortalToken } from "@/lib/guest-portal/tokens";
import { guestPortalTokenSchema } from "@/lib/validation/guest-token";

describe("guest portal tokens", () => {
  it("rejects reservation-style identifiers", () => {
    expect(guestPortalTokenSchema.safeParse("12345").success).toBe(false);
    expect(guestPortalTokenSchema.safeParse("reservation-123").success).toBe(
      false,
    );
  });

  it("rejects an invalid token", () => {
    const issued = generateGuestPortalToken();

    expect(() =>
      assertGuestPortalAccess({
        token: "this-is-not-the-issued-token-value-at-all",
        storedHash: issued.hash,
      }),
    ).toThrow(AuthorizationError);
  });

  it("rejects a revoked token", () => {
    const issued = generateGuestPortalToken();

    expect(() =>
      assertGuestPortalAccess({
        token: issued.token,
        storedHash: issued.hash,
        revoked: true,
      }),
    ).toThrow(/no longer valid/);
  });

  it("rejects an expired token", () => {
    const issued = generateGuestPortalToken();

    expect(() =>
      assertGuestPortalAccess({
        token: issued.token,
        storedHash: issued.hash,
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      }),
    ).toThrow(/expired/);
  });

  it("accepts a current hashed token", () => {
    const issued = generateGuestPortalToken();

    expect(() =>
      assertGuestPortalAccess({
        token: issued.token,
        storedHash: issued.hash,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      }),
    ).not.toThrow();
  });
});
