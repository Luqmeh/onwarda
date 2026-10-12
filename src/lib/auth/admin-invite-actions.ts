"use server";

import { adminInviteEligibility } from "@/lib/auth/admin-invite";
import { getPlatformAdminContext } from "@/lib/authorization/platform-admin";
import { AuthenticationError } from "@/lib/errors";

export async function readAdminInviteIdentity(): Promise<{ ok: true } | { ok: false }> {
  try {
    const context = await getPlatformAdminContext();
    if (!context || adminInviteEligibility(context.admin) !== "accept") {
      return { ok: false };
    }

    return { ok: true };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return { ok: false };
    }

    throw error;
  }
}
