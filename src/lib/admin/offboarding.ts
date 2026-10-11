import "server-only";

import { redirect } from "next/navigation";
import { z } from "zod";

import { ADMIN_ROUTES } from "@/config/admin";
import { requirePlatformAdmin } from "@/lib/authorization/platform-admin";
import { createServiceRoleClient } from "@/lib/database/admin";
import { createSupabaseServerClient } from "@/lib/database/server";
import { AppError, AuthenticationError, AuthorizationError, NotFoundError, ValidationError } from "@/lib/errors";
import { uuidSchema } from "@/lib/validation/common";
import { ORGANIZATION_STATUSES } from "@/types/enums";

const TENANT_BUCKETS = [
  "organization-assets",
  "property-media",
  "guest-documents",
  "organization-branding",
] as const;

const deletionRequestSchema = z.object({
  organizationId: uuidSchema,
  confirmation: z.string().trim().min(1).max(63),
  acknowledge: z.literal(true),
});

export type DeletionCounts = {
  organizations: number;
  onboarding: number;
  branding: number;
  members: number;
  properties: number;
  reservations: number;
  guests: number;
  guestPortalTokens: number;
  guestRuleAcceptances: number;
  propertyLanguages: number;
  propertyAmenities: number;
  propertyHouseRules: number;
  propertyContent: number;
  propertyKnowledge: number;
  propertyMedia: number;
  issues: number;
  events: number;
  cleaningAgents: number;
  cleaningAgentLinks: number;
  propertyCleaningAgents: number;
  cleaningTasks: number;
  cleaningTaskItems: number;
  subscriptions: number;
  subscriptionEvents: number;
  supportSessions: number;
  auditLogs: number;
  storageObjects: number;
};

export type DeletionAuthSummary = {
  eligible: number;
  shared: number;
  platformAdmins: number;
  review: number;
};

export type OrganizationDeletionPreview = {
  counts: DeletionCounts;
  auth: DeletionAuthSummary;
  preservedShared: string[];
};

export type DeletionCleanupState = {
  jobId: string;
  storageRemoved: boolean;
  databaseRemoved: boolean;
  authRemoved: boolean;
  detail: string;
};

export type DeletionActionState = {
  error?: string;
  incomplete?: DeletionCleanupState;
};

type PreviewPayload = {
  status: string;
  counts: DeletionCounts;
  auth: DeletionAuthSummary;
  eligibleUserIds: string[];
  preservedShared: string[];
};

type DeletionJob = {
  id: string;
  organization_id: string | null;
  actor_user_id: string;
  phase: string;
  storage_removed: boolean;
  database_removed: boolean;
  auth_removed: boolean;
  auth_user_ids: string[];
  storage_error: string | null;
  database_error: string | null;
  auth_error: string | null;
  completed_at: string | null;
};

const EMPTY_COUNTS: DeletionCounts = {
  organizations: 0,
  onboarding: 0,
  branding: 0,
  members: 0,
  properties: 0,
  reservations: 0,
  guests: 0,
  guestPortalTokens: 0,
  guestRuleAcceptances: 0,
  propertyLanguages: 0,
  propertyAmenities: 0,
  propertyHouseRules: 0,
  propertyContent: 0,
  propertyKnowledge: 0,
  propertyMedia: 0,
  issues: 0,
  events: 0,
  cleaningAgents: 0,
  cleaningAgentLinks: 0,
  propertyCleaningAgents: 0,
  cleaningTasks: 0,
  cleaningTaskItems: 0,
  subscriptions: 0,
  subscriptionEvents: 0,
  supportSessions: 0,
  auditLogs: 0,
  storageObjects: 0,
};

function tenantPrefix(organizationId: string) {
  return `organizations/${organizationId}/`;
}

function isTenantObjectPath(organizationId: string, path: string) {
  return path.startsWith(tenantPrefix(organizationId));
}

async function loadOrganization(
  privileged: ReturnType<typeof createServiceRoleClient>,
  organizationId: string,
) {
  const { data, error } = await privileged
    .from("organizations")
    .select("id, slug, status")
    .eq("id", organizationId)
    .maybeSingle();

  if (error) {
    throw new AppError("deletion_lookup_failed", "The client could not be loaded.", 500);
  }

  return data;
}

async function loadPreviewPayload(
  privileged: ReturnType<typeof createServiceRoleClient>,
  organizationId: string,
) {
  const { data, error } = await privileged.rpc("admin_organization_deletion_preview", {
    p_organization_id: organizationId,
  });

  if (error || !data || typeof data !== "object") {
    throw new AppError("deletion_preview_failed", "The deletion review could not be loaded.", 500);
  }

  const payload = data as PreviewPayload;

  if (payload.status === "not_found") {
    throw new NotFoundError("That client no longer exists.");
  }

  if (!Array.isArray(payload.eligibleUserIds)) {
    payload.eligibleUserIds = [];
  }

  return payload;
}

export async function getOrganizationDeletionPreview(
  organizationId: string,
): Promise<OrganizationDeletionPreview> {
  await requirePlatformAdmin();
  const privileged = createServiceRoleClient();
  const payload = await loadPreviewPayload(privileged, organizationId);

  return {
    counts: { ...EMPTY_COUNTS, ...payload.counts },
    auth: payload.auth,
    preservedShared: payload.preservedShared ?? [],
  };
}

async function listTenantObjects(
  privileged: ReturnType<typeof createServiceRoleClient>,
  bucket: (typeof TENANT_BUCKETS)[number],
  organizationId: string,
  prefix: string,
): Promise<string[]> {
  const paths: string[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await privileged.storage.from(bucket).list(prefix, {
      limit: 100,
      offset,
    });

    if (error) {
      throw new Error(error.message);
    }

    const entries = data ?? [];

    for (const entry of entries) {
      const path = `${prefix}/${entry.name}`;

      if (!isTenantObjectPath(organizationId, path)) {
        continue;
      }

      if (entry.id) {
        paths.push(path);
      } else {
        paths.push(...(await listTenantObjects(privileged, bucket, organizationId, path)));
      }
    }

    if (entries.length < 100) {
      break;
    }

    offset += entries.length;
  }

  return paths;
}

async function removeTenantStorage(
  privileged: ReturnType<typeof createServiceRoleClient>,
  organizationId: string,
) {
  const prefix = `organizations/${organizationId}`;

  for (const bucket of TENANT_BUCKETS) {
    const paths = await listTenantObjects(privileged, bucket, organizationId, prefix);
    const owned = paths.filter((path) => isTenantObjectPath(organizationId, path));

    for (let index = 0; index < owned.length; index += 100) {
      const chunk = owned.slice(index, index + 100);
      const { error } = await privileged.storage.from(bucket).remove(chunk);

      if (error) {
        throw new Error(error.message);
      }
    }
  }
}

async function deleteExclusiveAuthUsers(
  privileged: ReturnType<typeof createServiceRoleClient>,
  userIds: string[],
) {
  const remaining: string[] = [];

  for (const userId of userIds) {
    const { error } = await privileged.auth.admin.deleteUser(userId);

    if (error && !/not found/i.test(error.message)) {
      remaining.push(userId);
    }
  }

  return remaining;
}

async function findOpenJob(
  privileged: ReturnType<typeof createServiceRoleClient>,
  organizationId: string,
) {
  const { data, error } = await privileged
    .from("platform_deletion_jobs")
    .select(
      "id, organization_id, actor_user_id, phase, storage_removed, database_removed, auth_removed, auth_user_ids, storage_error, database_error, auth_error, completed_at",
    )
    .eq("organization_id", organizationId)
    .is("completed_at", null)
    .maybeSingle();

  if (error) {
    throw new AppError("deletion_job_failed", "The deletion job could not be loaded.", 500);
  }

  return (data as DeletionJob | null) ?? null;
}

async function loadJob(
  privileged: ReturnType<typeof createServiceRoleClient>,
  jobId: string,
) {
  const { data, error } = await privileged
    .from("platform_deletion_jobs")
    .select(
      "id, organization_id, actor_user_id, phase, storage_removed, database_removed, auth_removed, auth_user_ids, storage_error, database_error, auth_error, completed_at",
    )
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    throw new AppError("deletion_job_failed", "The deletion job could not be loaded.", 500);
  }

  return (data as DeletionJob | null) ?? null;
}

function incompleteState(job: DeletionJob, detail: string): DeletionCleanupState {
  return {
    jobId: job.id,
    storageRemoved: job.storage_removed,
    databaseRemoved: job.database_removed,
    authRemoved: job.auth_removed,
    detail,
  };
}

async function saveJob(
  privileged: ReturnType<typeof createServiceRoleClient>,
  jobId: string,
  patch: Record<string, unknown>,
) {
  const { error } = await privileged
    .from("platform_deletion_jobs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", jobId);

  if (error) {
    throw new AppError("deletion_job_failed", "The deletion job could not be saved.", 500);
  }
}

async function runDeletionJob(
  privileged: ReturnType<typeof createServiceRoleClient>,
  actorUserId: string,
  job: DeletionJob,
): Promise<DeletionCleanupState | "complete"> {
  if (!job.organization_id) {
    return incompleteState(job, "This cleanup no longer has a tenant scope and was stopped.");
  }

  const organizationId = job.organization_id;

  if (!job.storage_removed) {
    try {
      await removeTenantStorage(privileged, organizationId);
      job.storage_removed = true;
      job.storage_error = null;
      job.phase = "database";
      await saveJob(privileged, job.id, {
        storage_removed: true,
        storage_error: null,
        phase: "database",
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Storage cleanup failed.";
      job.storage_error = detail;
      job.phase = "incomplete";
      await saveJob(privileged, job.id, { storage_error: detail, phase: "incomplete" });
      return incompleteState(
        job,
        "Storage cleanup did not finish. Database records were not deleted. Retry to continue.",
      );
    }
  }

  if (!job.database_removed) {
    const { data, error } = await privileged.rpc("admin_purge_organization_data", {
      p_organization_id: organizationId,
      p_actor_user_id: actorUserId,
    });

    if (error) {
      job.database_error = error.message;
      job.phase = "incomplete";
      await saveJob(privileged, job.id, {
        database_error: error.message,
        phase: "incomplete",
      });
      return incompleteState(
        job,
        "The database purge did not finish. No deletion success is recorded. Retry to continue.",
      );
    }

    const status = (data as { status?: string } | null)?.status;

    if (status !== "removed" && status !== "already_removed") {
      job.phase = "incomplete";
      await saveJob(privileged, job.id, { phase: "incomplete" });
      return incompleteState(job, "The database purge returned an unexpected result.");
    }

    job.database_removed = true;
    job.database_error = null;
    job.phase = "auth";
    await saveJob(privileged, job.id, {
      database_removed: true,
      database_error: null,
      phase: "auth",
    });
  }

  if (!job.auth_removed) {
    const remaining = await deleteExclusiveAuthUsers(privileged, job.auth_user_ids ?? []);

    if (remaining.length > 0) {
      job.auth_user_ids = remaining;
      job.auth_removed = false;
      job.auth_error = "One or more exclusive accounts could not be removed.";
      job.phase = "incomplete";
      await saveJob(privileged, job.id, {
        auth_user_ids: remaining,
        auth_removed: false,
        auth_error: job.auth_error,
        phase: "incomplete",
      });
      return incompleteState(
        job,
        "The organization data was removed, but some exclusive accounts still need cleanup. Retry to continue.",
      );
    }

    job.auth_removed = true;
    job.auth_user_ids = [];
    job.auth_error = null;
  }

  await saveJob(privileged, job.id, {
    organization_id: null,
    auth_user_ids: [],
    storage_removed: true,
    database_removed: true,
    auth_removed: true,
    storage_error: null,
    database_error: null,
    auth_error: null,
    phase: "complete",
    completed_at: new Date().toISOString(),
  });

  return "complete";
}

async function ensureJob(
  privileged: ReturnType<typeof createServiceRoleClient>,
  actorUserId: string,
  organizationId: string,
  eligibleUserIds: string[],
) {
  const existing = await findOpenJob(privileged, organizationId);

  if (existing) {
    if (!existing.database_removed) {
      existing.auth_user_ids = eligibleUserIds;
      await saveJob(privileged, existing.id, { auth_user_ids: eligibleUserIds });
    }

    return existing;
  }

  const { data, error } = await privileged
    .from("platform_deletion_jobs")
    .insert({
      organization_id: organizationId,
      actor_user_id: actorUserId,
      phase: "blocked",
      auth_user_ids: eligibleUserIds,
    })
    .select(
      "id, organization_id, actor_user_id, phase, storage_removed, database_removed, auth_removed, auth_user_ids, storage_error, database_error, auth_error, completed_at",
    )
    .single();

  if (error || !data) {
    const raced = await findOpenJob(privileged, organizationId);

    if (raced) {
      return raced;
    }

    throw new AppError("deletion_job_failed", "The deletion job could not be started.", 500);
  }

  return data as DeletionJob;
}

export async function permanentlyDeleteOrganization(input: {
  organizationId: string;
  confirmation: string;
  acknowledge: boolean;
}): Promise<DeletionActionState | { status: "complete" }> {
  const admin = await requirePlatformAdmin();
  const parsed = deletionRequestSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError(
      "Type the organization slug and confirm that this deletion is permanent.",
    );
  }

  const privileged = createServiceRoleClient();
  const organization = await loadOrganization(privileged, parsed.data.organizationId);

  if (!organization) {
    throw new NotFoundError("That client no longer exists.");
  }

  if (parsed.data.confirmation !== organization.slug) {
    throw new ValidationError("The confirmation text does not match this organization's slug.");
  }

  const preview = await loadPreviewPayload(privileged, organization.id);
  const job = await ensureJob(
    privileged,
    admin.user.id,
    organization.id,
    preview.eligibleUserIds ?? [],
  );

  if (
    organization.status === ORGANIZATION_STATUSES.ACTIVE ||
    organization.status === ORGANIZATION_STATUSES.PENDING
  ) {
    const scoped = await createSupabaseServerClient();
    const { error } = await scoped.rpc("set_organization_status", {
      p_organization_id: organization.id,
      p_status: ORGANIZATION_STATUSES.SUSPENDED,
    });

    if (error) {
      throw new AppError(
        "deletion_block_failed",
        "The client could not be suspended before deletion.",
        500,
      );
    }
  }

  const { error: blockError } = await privileged.rpc("admin_block_organization_for_deletion", {
    p_organization_id: organization.id,
    p_actor_user_id: admin.user.id,
  });

  if (blockError) {
    throw new AppError(
      "deletion_block_failed",
      "Guest and cleaner access could not be revoked.",
      500,
    );
  }

  const result = await runDeletionJob(privileged, admin.user.id, job);

  if (result === "complete") {
    return { status: "complete" };
  }

  return { incomplete: result };
}

export async function permanentlyDeleteOrganizationAction(
  _previous: DeletionActionState,
  formData: FormData,
): Promise<DeletionActionState> {
  try {
    const result = await permanentlyDeleteOrganization({
      organizationId: String(formData.get("organizationId") ?? ""),
      confirmation: String(formData.get("confirmation") ?? ""),
      acknowledge: formData.get("acknowledge") === "delete",
    });

    if ("incomplete" in result) {
      return result;
    }

    redirect(`${ADMIN_ROUTES.clients}?notice=client-deleted`);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error;
    }

    if (typeof error === "object" && error && "digest" in error) {
      throw error;
    }

    if (error instanceof AuthorizationError) {
      return { error: "Platform administrator access is required." };
    }

    if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof AppError) {
      return { error: error.message };
    }

    return { error: "The client could not be deleted." };
  }
}

export async function retryOrganizationDeletion(jobId: string) {
  const admin = await requirePlatformAdmin();
  const parsedId = uuidSchema.safeParse(jobId);

  if (!parsedId.success) {
    throw new ValidationError("That cleanup job is not valid.");
  }

  const privileged = createServiceRoleClient();
  const job = await loadJob(privileged, parsedId.data);

  if (!job || job.completed_at) {
    return { error: "There is no unfinished cleanup for that deletion." } satisfies DeletionActionState;
  }

  const result = await runDeletionJob(privileged, admin.user.id, job);

  if (result === "complete") {
    return { status: "complete" as const };
  }

  return { incomplete: result };
}

export async function retryOrganizationDeletionAction(formData: FormData) {
  try {
    const result = await retryOrganizationDeletion(String(formData.get("jobId") ?? ""));

    if ("status" in result && result.status === "complete") {
      redirect(`${ADMIN_ROUTES.clients}?notice=client-deleted`);
    }

    const detail =
      "incomplete" in result && result.incomplete
        ? result.incomplete.detail
        : result.error ?? "Cleanup is still incomplete.";

    redirect(`${ADMIN_ROUTES.clients}?notice=cleanup-incomplete&detail=${encodeURIComponent(detail)}`);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    if (typeof error === "object" && error && "digest" in error) {
      throw error;
    }

    redirect(`${ADMIN_ROUTES.clients}?notice=cleanup-incomplete`);
  }
}

export async function listIncompleteDeletionJobs() {
  await requirePlatformAdmin();
  const privileged = createServiceRoleClient();
  const { data, error } = await privileged
    .from("platform_deletion_jobs")
    .select("id, phase, storage_removed, database_removed, auth_removed, created_at")
    .is("completed_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    throw new AppError("deletion_job_failed", "Open deletion jobs could not be loaded.", 500);
  }

  return data ?? [];
}

export async function getOpenDeletionJob(organizationId: string) {
  await requirePlatformAdmin();
  const privileged = createServiceRoleClient();
  return findOpenJob(privileged, organizationId);
}
