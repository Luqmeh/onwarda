"use server";

import { getPlatformAdminContext, requireActivePlatformAdminWithMfa } from "@/lib/authorization/platform-admin";
import { requireUser } from "@/lib/auth/session";
import { AuthenticationError, AuthorizationError } from "@/lib/errors";

export type PasswordChangeAudience = "client" | "admin";

export async function authorizePasswordChange(
  audience: PasswordChangeAudience,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    if (audience === "admin") {
      await requireActivePlatformAdminWithMfa();
      return { ok: true };
    }

    await requireUser();
    const admin = await getPlatformAdminContext();
    if (admin) {
      await requireActivePlatformAdminWithMfa();
    }

    return { ok: true };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return { ok: false, message: "Sign in again before changing your password." };
    }

    if (error instanceof AuthorizationError) {
      return {
        ok: false,
        message: "Verify your authenticator before changing this password.",
      };
    }

    throw error;
  }
}
