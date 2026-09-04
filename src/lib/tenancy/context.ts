import "server-only";

import { AuthorizationError, TenantIsolationError } from "@/lib/errors";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/database/server";
import { assertSameOrganization } from "@/lib/tenancy/assert";
import {
  ORGANIZATION_STATUSES,
  ORGANIZATION_USER_STATUSES,
  type OrganizationUserRole,
} from "@/types/enums";
import type { OrganizationMembershipContext } from "@/types/auth";
import type { Organization, OrganizationUser, Profile } from "@/types/database";

function isMissingRelation(error: { code?: string; message?: string }) {
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    error.message?.includes("does not exist") === true
  );
}

export async function getCurrentOrganization(): Promise<OrganizationMembershipContext | null> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data: membership, error } = await supabase
    .from("organization_users")
    .select(
      "id, organization_id, user_id, role, status, created_at, updated_at",
    )
    .eq("user_id", user.id)
    .eq("status", ORGANIZATION_USER_STATUSES.ACTIVE)
    .limit(2);

  if (error) {
    if (isMissingRelation(error)) {
      return null;
    }

    throw new AuthorizationError("Unable to resolve organization membership.");
  }

  if (!membership || membership.length === 0) {
    return null;
  }

  if (membership.length > 1) {
    throw new AuthorizationError(
      "Multiple organization memberships are not selected automatically.",
    );
  }

  const currentMembership = membership[0] as OrganizationUser;

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select(
      "id, name, slug, legal_name, status, subscription_status, onboarding_status, logo_url, primary_color, secondary_color, accent_color, website, phone, country, timezone, default_language, created_at, updated_at",
    )
    .eq("id", currentMembership.organization_id)
    .maybeSingle();

  if (organizationError || !organization) {
    return null;
  }

  if (organization.status === ORGANIZATION_STATUSES.SUSPENDED) {
    throw new AuthorizationError("This organization is suspended.");
  }

  if (organization.status === ORGANIZATION_STATUSES.ARCHIVED) {
    throw new AuthorizationError("This organization is archived.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url, created_at, updated_at")
    .eq("id", user.id)
    .maybeSingle();

  return {
    user,
    profile: (profile as Profile | null) ?? null,
    membership: currentMembership,
    organization: organization as Organization,
  };
}

export async function requireCurrentOrganization(): Promise<OrganizationMembershipContext> {
  const context = await getCurrentOrganization();

  if (!context) {
    throw new AuthorizationError(
      "An organization membership is required to access the client workspace.",
    );
  }

  return context;
}

export async function requireOrganizationMembership(
  organizationId: string,
): Promise<OrganizationMembershipContext> {
  const context = await requireCurrentOrganization();
  assertSameOrganization(context.organization.id, organizationId);
  return context;
}

export async function requireOrganizationRole(
  allowedRoles: OrganizationUserRole[],
  organizationId?: string,
): Promise<OrganizationMembershipContext> {
  const context = organizationId
    ? await requireOrganizationMembership(organizationId)
    : await requireCurrentOrganization();

  if (!allowedRoles.includes(context.membership.role)) {
    throw new TenantIsolationError(
      "This action requires a higher organization role.",
    );
  }

  return context;
}
