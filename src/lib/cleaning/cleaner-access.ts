import "server-only";

import { createServiceRoleClient } from "@/lib/database/admin";
import { hashCleanerToken } from "@/lib/cleaning/tokens";
import { cleanerTokenSchema } from "@/lib/validation/cleaning";

export type CleanerLinkStatus = "valid" | "invalid" | "revoked" | "expired" | "disabled" | "forbidden";

export type CleanerHomeTask = {
  propertyId: string;
  taskId: string | null;
  propertyName: string;
  city: string | null;
  address: string | null;
  status: string | null;
  checkedOutAt: string | null;
  createdAt: string;
  completedCount: number;
  totalCount: number;
};

export type CleanerHome = {
  status: CleanerLinkStatus;
  cleanerName?: string;
  organizationName?: string;
  active: CleanerHomeTask[];
  completedToday: Array<{ taskId: string; propertyName: string; completedAt: string | null }>;
};

export type CleanerTaskItem = {
  key: string;
  category: string;
  label: string;
  sortOrder: number;
  required: boolean;
  completedAt: string | null;
};

export type CleanerTaskView = {
  status: CleanerLinkStatus | "ok" | "closed" | "not_started";
  cleanerName?: string;
  taskId?: string;
  taskStatus?: string;
  startedAt?: string | null;
  completedAt?: string | null;
  checkedOutAt?: string | null;
  propertyName?: string;
  address?: string | null;
  city?: string | null;
  items: CleanerTaskItem[];
};

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function hashOrNull(token: string) {
  const parsed = cleanerTokenSchema.safeParse(token);
  return parsed.success ? hashCleanerToken(parsed.data) : null;
}

export async function loadCleanerHome(token: string): Promise<CleanerHome> {
  const tokenHash = hashOrNull(token);

  if (!tokenHash) {
    return { status: "invalid", active: [], completedToday: [] };
  }

  const privileged = createServiceRoleClient();
  const { data, error } = await privileged.rpc("get_cleaner_home", {
    p_token_hash: tokenHash,
  });
  const payload = asRecord(data);

  if (error || !payload) {
    return { status: "invalid", active: [], completedToday: [] };
  }

  const status = String(payload.status ?? "invalid") as CleanerLinkStatus;

  if (status !== "valid") {
    return { status, active: [], completedToday: [] };
  }

  return {
    status,
    cleanerName: typeof payload.cleanerName === "string" ? payload.cleanerName : undefined,
    organizationName:
      typeof payload.organizationName === "string" ? payload.organizationName : undefined,
    active: Array.isArray(payload.active) ? (payload.active as CleanerHomeTask[]) : [],
    completedToday: Array.isArray(payload.completedToday)
      ? (payload.completedToday as CleanerHome["completedToday"])
      : [],
  };
}

export async function loadCleanerTask(token: string, taskId: string): Promise<CleanerTaskView> {
  const tokenHash = hashOrNull(token);

  if (!tokenHash) {
    return { status: "invalid", items: [] };
  }

  const privileged = createServiceRoleClient();
  const { data, error } = await privileged.rpc("get_cleaner_task", {
    p_token_hash: tokenHash,
    p_task_id: taskId,
  });
  const payload = asRecord(data);

  if (error || !payload) {
    return { status: "invalid", items: [] };
  }

  return {
    status: String(payload.status ?? "invalid") as CleanerTaskView["status"],
    cleanerName: typeof payload.cleanerName === "string" ? payload.cleanerName : undefined,
    taskId: typeof payload.taskId === "string" ? payload.taskId : undefined,
    taskStatus: typeof payload.taskStatus === "string" ? payload.taskStatus : undefined,
    startedAt: typeof payload.startedAt === "string" ? payload.startedAt : null,
    completedAt: typeof payload.completedAt === "string" ? payload.completedAt : null,
    checkedOutAt: typeof payload.checkedOutAt === "string" ? payload.checkedOutAt : null,
    propertyName: typeof payload.propertyName === "string" ? payload.propertyName : undefined,
    address: typeof payload.address === "string" ? payload.address : null,
    city: typeof payload.city === "string" ? payload.city : null,
    items: Array.isArray(payload.items) ? (payload.items as CleanerTaskItem[]) : [],
  };
}

export async function callCleanerRpc(
  name: string,
  args: Record<string, string | boolean>,
) {
  const privileged = createServiceRoleClient();
  const { data, error } = await privileged.rpc(name, args);
  const payload = asRecord(data);

  if (error || !payload) {
    return { status: "invalid" };
  }

  return payload;
}

export { hashOrNull as hashCleanerAccessToken };
