import "server-only";

import { AuthenticationError, AuthorizationError } from "@/lib/errors";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/database/server";
import { PLATFORM_ADMIN_STATUSES } from "@/types/enums";
import type { PlatformAdminContext } from "@/types/auth";
import type { PlatformAdmin, Profile } from "@/types/database";

function isMissingRelation(error: { code?: string; message?: string }) {
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    error.message?.includes("does not exist") === true
  );
}

export async function getPlatformAdminContext(): Promise<PlatformAdminContext | null> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data: admin, error } = await supabase
    .from("platform_admins")
    .select("id, user_id, role, status, created_at, updated_at")
    .eq("user_id", user.id)
    .eq("status", PLATFORM_ADMIN_STATUSES.ACTIVE)
    .maybeSingle();

  if (error) {
    if (isMissingRelation(error)) {
      return null;
    }

    throw new AuthorizationError(
      "Unable to verify platform administrator access.",
    );
  }

  if (!admin) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url, created_at, updated_at")
    .eq("id", user.id)
    .maybeSingle();

  return {
    user,
    profile: (profile as Profile | null) ?? null,
    admin: admin as PlatformAdmin,
  };
}

export async function requirePlatformAdmin(): Promise<PlatformAdminContext> {
  const context = await getPlatformAdminContext();

  if (!context) {
    throw new AuthorizationError(
      "Platform administrator access is required.",
    );
  }

  return context;
}

export type PlatformAdminMfaGate =
  | { status: "unauthenticated" }
  | { status: "denied" }
  | { status: "enroll"; context: PlatformAdminContext }
  | { status: "challenge"; context: PlatformAdminContext }
  | { status: "ready"; context: PlatformAdminContext };

/**
 * Active platform-admin identity plus a server-verified Supabase session at aal2.
 * Enrollment and challenge screens use requirePlatformAdmin() instead, so an
 * aal1 administrator can register a factor without opening the rest of /admin.
 */
export async function getPlatformAdminMfaGate(): Promise<PlatformAdminMfaGate> {
  let context: PlatformAdminContext | null;

  try {
    context = await getPlatformAdminContext();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return { status: "unauthenticated" };
    }

    throw error;
  }

  if (!context) {
    return { status: "denied" };
  }

  const supabase = await createSupabaseServerClient();
  const { data: assurance, error: assuranceError } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const { data: factors, error: factorError } = await supabase.auth.mfa.listFactors();

  if (assuranceError || factorError || !assurance) {
    throw new AuthorizationError("Unable to verify multi-factor authentication.");
  }

  const verifiedTotp = (factors?.totp ?? []).some((factor) => factor.status === "verified");

  if (assurance.currentLevel === "aal2" && verifiedTotp) {
    return { status: "ready", context };
  }

  if (verifiedTotp) {
    return { status: "challenge", context };
  }

  return { status: "enroll", context };
}

export async function requireActivePlatformAdminWithMfa(): Promise<PlatformAdminContext> {
  const gate = await getPlatformAdminMfaGate();

  if (gate.status === "unauthenticated") {
    throw new AuthenticationError();
  }

  if (gate.status === "denied") {
    throw new AuthorizationError("Platform administrator access is required.");
  }

  if (gate.status !== "ready") {
    throw new AuthorizationError("Multi-factor authentication is required.");
  }

  return gate.context;
}
