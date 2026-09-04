import { AuthorizationError } from "@/lib/errors";
import {
  guestPortalTokensMatch,
  isGuestPortalExpired,
} from "@/lib/guest-portal/tokens";
import { guestPortalTokenSchema } from "@/lib/validation/guest-token";

export function assertGuestPortalAccess(input: {
  token: string;
  storedHash: string | null;
  expiresAt?: string | Date | null;
  revoked?: boolean;
  revokedAt?: string | Date | null;
}) {
  const parsed = guestPortalTokenSchema.safeParse(input.token);

  if (!parsed.success) {
    throw new AuthorizationError("This guest link is invalid.");
  }

  if (!input.storedHash || input.revoked || input.revokedAt) {
    throw new AuthorizationError("This guest link is no longer valid.");
  }

  if (!guestPortalTokensMatch(parsed.data, input.storedHash)) {
    throw new AuthorizationError("This guest link is invalid.");
  }

  if (isGuestPortalExpired(input.expiresAt)) {
    throw new AuthorizationError("This guest link has expired.");
  }
}
