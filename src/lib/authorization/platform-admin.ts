import "server-only";

import { AuthorizationError } from "@/lib/errors";
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
