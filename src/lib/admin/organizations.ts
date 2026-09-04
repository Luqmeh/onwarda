import "server-only";

import { ADMIN_CLIENT_PAGE_SIZE } from "@/config/admin";
import { AppError, NotFoundError } from "@/lib/errors";
import { requirePlatformAdmin } from "@/lib/authorization/platform-admin";
import { createServiceRoleClient } from "@/lib/database/admin";
import { createSupabaseServerClient } from "@/lib/database/server";
import { sanitizeOrganizationSearch } from "@/lib/validation/organization";
import { ORGANIZATION_STATUSES } from "@/types/enums";

type EmbeddedCount = { count: number }[] | null | undefined;

function embeddedCount(value: EmbeddedCount) {
  const count = value?.[0]?.count;
  return typeof count === "number" && count >= 0 ? count : 0;
}

export type AdminOrganizationSummary = {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  userCount: number;
  propertyCount: number;
  reservationCount: number;
  guestCount: number;
};

export type AdminOrganizationList = {
  organizations: AdminOrganizationSummary[];
  total: number;
  page: number;
  pageSize: number;
  query: string;
  status: string;
};

export type AdminOrganizationMember = {
  id: string;
  userId: string;
  email: string | null;
  fullName: string | null;
  role: string;
  status: string;
  createdAt: string;
};

export type AdminAuditEntryDetail = {
  id: string;
  action: string;
  actorType: string;
  targetType: string;
  createdAt: string;
};

export type AdminProductEvent = {
  id: string;
  eventType: string;
  createdAt: string;
};

export type AdminOrganizationDetail = AdminOrganizationSummary & {
  legalName: string | null;
  onboardingStatus: string;
  subscriptionStatus: string;
  updatedAt: string;
  openIssueCount: number;
  owner: AdminOrganizationMember | null;
  lastActivityAt: string | null;
  members: AdminOrganizationMember[];
  auditActivity: AdminAuditEntryDetail[];
  productEvents: AdminProductEvent[];
};

function mapSummary(row: {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
  organization_users?: EmbeddedCount;
  properties?: EmbeddedCount;
  reservations?: EmbeddedCount;
  guests?: EmbeddedCount;
}): AdminOrganizationSummary {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    createdAt: row.created_at,
    userCount: embeddedCount(row.organization_users),
    propertyCount: embeddedCount(row.properties),
    reservationCount: embeddedCount(row.reservations),
    guestCount: embeddedCount(row.guests),
  };
}

const LIST_SELECT = `
  id,
  name,
  slug,
  status,
  created_at,
  organization_users(count),
  properties(count),
  reservations(count),
  guests(count)
`;

export async function listAdminOrganizations(options: {
  query?: string;
  status?: string;
  page?: number;
}): Promise<AdminOrganizationList> {
  await requirePlatformAdmin();

  const query = sanitizeOrganizationSearch(options.query ?? "");
  const status =
    options.status &&
    (Object.values(ORGANIZATION_STATUSES) as string[]).includes(options.status)
      ? options.status
      : "";
  const page = Number.isInteger(options.page) && (options.page ?? 0) > 0
    ? (options.page as number)
    : 1;
  const from = (page - 1) * ADMIN_CLIENT_PAGE_SIZE;
  const to = from + ADMIN_CLIENT_PAGE_SIZE - 1;

  const privileged = createServiceRoleClient();
  let request = privileged
    .from("organizations")
    .select(LIST_SELECT, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status) {
    request = request.eq("status", status);
  }

  if (query) {
    request = request.or(`name.ilike.%${query}%,slug.ilike.%${query}%`);
  }

  const { data, error, count } = await request;

  if (error) {
    throw new AppError(
      "admin_clients_unavailable",
      "Unable to load clients.",
      500,
    );
  }

  return {
    organizations: (data ?? []).map((row) =>
      mapSummary(row as Parameters<typeof mapSummary>[0]),
    ),
    total: count ?? 0,
    page,
    pageSize: ADMIN_CLIENT_PAGE_SIZE,
    query,
    status,
  };
}

export async function getAdminOrganization(
  organizationId: string,
): Promise<AdminOrganizationDetail> {
  await requirePlatformAdmin();
  const privileged = createServiceRoleClient();
  const scoped = await createSupabaseServerClient();

  const [
    { data: organization, error: organizationError },
    { data: members, error: memberError },
    { count: openIssueCount, error: issueError },
    { data: auditActivity, error: auditError },
    { data: productEvents, error: eventError },
  ] = await Promise.all([
      privileged
        .from("organizations")
        .select(
          `
          id,
          name,
          slug,
          status,
          legal_name,
          onboarding_status,
          subscription_status,
          created_at,
          updated_at,
          organization_users(count),
          properties(count),
          reservations(count),
          guests(count)
        `,
        )
        .eq("id", organizationId)
        .maybeSingle(),
      privileged
        .from("organization_users")
        .select("id, user_id, role, status, created_at, profiles(full_name, email)")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: true }),
      privileged
        .from("issues")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .in("status", ["open", "in_progress"]),
      scoped
        .from("audit_logs")
        .select("id, action, actor_type, target_type, created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(8),
      privileged
        .from("events")
        .select("id, event_type, created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

  if (organizationError || memberError || issueError || auditError || eventError) {
    throw new AppError(
      "admin_client_unavailable",
      "Unable to load this client.",
      500,
    );
  }

  if (!organization) {
    throw new NotFoundError("Client organization not found.");
  }

  const summary = mapSummary(organization as Parameters<typeof mapSummary>[0]);
  const mappedMembers = (members ?? []).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;

    return {
      id: row.id,
      userId: row.user_id,
      email: profile?.email ?? null,
      fullName: profile?.full_name ?? null,
      role: row.role,
      status: row.status,
      createdAt: row.created_at,
    };
  });
  const owner =
    mappedMembers.find((member) => member.role === "owner" && member.status !== "suspended") ??
    mappedMembers.find((member) => member.role === "owner") ??
    null;
  const auditEntries = (auditActivity ?? []).map((row) => ({
    id: row.id,
    action: row.action,
    actorType: row.actor_type,
    targetType: row.target_type,
    createdAt: row.created_at,
  }));
  const eventEntries = (productEvents ?? []).map((row) => ({
    id: row.id,
    eventType: row.event_type,
    createdAt: row.created_at,
  }));
  const lastActivityAt = [...auditEntries, ...eventEntries]
    .map((entry) => entry.createdAt)
    .sort()
    .at(-1) ?? organization.updated_at;

  return {
    ...summary,
    legalName: organization.legal_name,
    onboardingStatus: organization.onboarding_status,
    subscriptionStatus: organization.subscription_status,
    updatedAt: organization.updated_at,
    openIssueCount: typeof openIssueCount === "number" ? openIssueCount : 0,
    owner,
    lastActivityAt,
    members: mappedMembers,
    auditActivity: auditEntries,
    productEvents: eventEntries,
  };
}

