import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const GUEST_TOKEN_BYTES = 32;

export function generateGuestPortalToken() {
  const token = randomBytes(GUEST_TOKEN_BYTES).toString("base64url");

  return {
    token,
    hash: hashGuestPortalToken(token),
  };
}

export function hashGuestPortalToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function guestPortalTokensMatch(token: string, storedHash: string) {
  const computed = Buffer.from(hashGuestPortalToken(token), "hex");
  const stored = Buffer.from(storedHash, "hex");

  if (computed.length !== stored.length) {
    return false;
  }

  return timingSafeEqual(computed, stored);
}

export function isGuestPortalExpired(expiresAt: string | Date | null | undefined) {
  if (!expiresAt) {
    return false;
  }

  return new Date(expiresAt).getTime() <= Date.now();
}
