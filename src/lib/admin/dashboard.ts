import "server-only";

import { AppError } from "@/lib/errors";
import { requirePlatformAdmin } from "@/lib/authorization/platform-admin";
import { createServiceRoleClient } from "@/lib/database/admin";
import { createSupabaseServerClient } from "@/lib/database/server";
import type { PlatformAdminContext } from "@/types/auth";

export type PlatformMetricKey =
  | "organizations"
  | "activeOrganizations"
  | "suspendedOrganizations"
  | "organizationUsers"
  | "properties"
  | "reservations"
  | "guests";

export type PlatformMetrics = Record<PlatformMetricKey, number>;

export type AdminAuditEntry = {
  id: string;
  action: string;
  actorType: string;
  targetType: string;
  createdAt: string;
};

function metricCount(count: number | null | undefined) {
  return typeof count === "number" && count >= 0 ? count : 0;
}

export function toMetricCount(count: number | null | undefined) {
  return metricCount(count);
}

export async function getAdminDashboardData(): Promise<{
  admin: PlatformAdminContext;
  metrics: PlatformMetrics;
  activity: AdminAuditEntry[];
}> {
  const admin = await requirePlatformAdmin();
  const privileged = createServiceRoleClient();
  const scoped = await createSupabaseServerClient();

  const [
    organizations,
    activeOrganizations,
    suspendedOrganizations,
    organizationUsers,
    properties,
    reservations,
    guests,
    activity,
  ] = await Promise.all([
    privileged.from("organizations").select("id", { count: "exact", head: true }),
    privileged
      .from("organizations")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    privileged
      .from("organizations")
      .select("id", { count: "exact", head: true })
      .eq("status", "suspended"),
    privileged
      .from("organization_users")
      .select("id", { count: "exact", head: true }),
    privileged.from("properties").select("id", { count: "exact", head: true }),
    privileged.from("reservations").select("id", { count: "exact", head: true }),
    privileged.from("guests").select("id", { count: "exact", head: true }),
    scoped
      .from("audit_logs")
      .select("id, action, actor_type, target_type, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  if (
    organizations.error ||
    activeOrganizations.error ||
    suspendedOrganizations.error ||
    organizationUsers.error ||
    properties.error ||
    reservations.error ||
    guests.error
  ) {
    throw new AppError(
      "admin_metrics_unavailable",
      "Unable to load platform metrics.",
      500,
    );
  }

  if (activity.error) {
    throw new AppError(
      "admin_activity_unavailable",
      "Unable to load recent activity.",
      500,
    );
  }

  return {
    admin,
    metrics: {
      organizations: metricCount(organizations.count),
      activeOrganizations: metricCount(activeOrganizations.count),
      suspendedOrganizations: metricCount(suspendedOrganizations.count),
      organizationUsers: metricCount(organizationUsers.count),
      properties: metricCount(properties.count),
      reservations: metricCount(reservations.count),
      guests: metricCount(guests.count),
    },
    activity: (activity.data ?? []).map((row) => ({
      id: row.id,
      action: row.action,
      actorType: row.actor_type,
      targetType: row.target_type,
      createdAt: row.created_at,
    })),
  };
}

export async function getAdminActivityFeed(limit = 25): Promise<AdminAuditEntry[]> {
  await requirePlatformAdmin();
  const scoped = await createSupabaseServerClient();
  const { data, error } = await scoped
    .from("audit_logs")
    .select("id, action, actor_type, target_type, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new AppError(
      "admin_activity_unavailable",
      "Unable to load activity.",
      500,
    );
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    action: row.action,
    actorType: row.actor_type,
    targetType: row.target_type,
    createdAt: row.created_at,
  }));
}

