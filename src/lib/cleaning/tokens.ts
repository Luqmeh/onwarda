import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const CLEANER_TOKEN_BYTES = 32;

export function generateCleanerToken() {
  const token = randomBytes(CLEANER_TOKEN_BYTES).toString("base64url");

  return {
    token,
    hash: hashCleanerToken(token),
  };
}

export function hashCleanerToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function cleanerTokensMatch(token: string, storedHash: string) {
  const computed = Buffer.from(hashCleanerToken(token), "hex");
  const stored = Buffer.from(storedHash, "hex");

  if (computed.length !== stored.length) {
    return false;
  }

  return timingSafeEqual(computed, stored);
}
