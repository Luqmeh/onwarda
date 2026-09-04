import "server-only";

import { cookies } from "next/headers";

import { SUPPORT_SESSION_COOKIE } from "@/config/admin";
import { getPlatformAdminContext } from "@/lib/authorization/platform-admin";
import { createSupabaseServerClient } from "@/lib/database/server";
import type { SupportWorkspaceContext } from "@/types/auth";
import type { Organization, Profile } from "@/types/database";

function isSessionActive(row: {
  ended_at: string | null;
  expires_at: string;
}) {
  if (row.ended_at) {
    return false;
  }

  return new Date(row.expires_at).getTime() > Date.now();
}

export async function resolveValidSupportWorkspace(): Promise<SupportWorkspaceContext | null> {
  const admin = await getPlatformAdminContext();

  if (!admin) {
    return null;
  }

  const store = await cookies();
  const sessionId = store.get(SUPPORT_SESSION_COOKIE)?.value;

  if (!sessionId) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data: session, error } = await supabase
    .from("support_sessions")
    .select(
      "id, organization_id, reason, started_at, expires_at, ended_at",
    )
    .eq("id", sessionId)
    .eq("platform_admin_user_id", admin.user.id)
    .maybeSingle();

  if (error || !session || !isSessionActive(session)) {
    return null;
  }

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select(
      "id, name, slug, legal_name, status, subscription_status, onboarding_status, logo_url, primary_color, secondary_color, accent_color, website, phone, country, timezone, default_language, created_at, updated_at",
    )
    .eq("id", session.organization_id)
    .maybeSingle();

  if (organizationError || !organization) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url, created_at, updated_at")
    .eq("id", admin.user.id)
    .maybeSingle();

  return {
    user: admin.user,
    profile: (profile as Profile | null) ?? admin.profile,
    organization: organization as Organization,
    supportSession: {
      id: session.id,
      organizationId: session.organization_id,
      organizationName: organization.name,
      organizationSlug: organization.slug,
      reason: session.reason,
      startedAt: session.started_at,
      expiresAt: session.expires_at,
    },
  };
}
