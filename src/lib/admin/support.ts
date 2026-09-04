"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  SUPPORT_SESSION_COOKIE,
  SUPPORT_SESSION_DURATION_MINUTES,
  adminClientPath,
} from "@/config/admin";
import { requirePlatformAdmin } from "@/lib/authorization/platform-admin";
import { createServiceRoleClient } from "@/lib/database/admin";
import { createSupabaseServerClient } from "@/lib/database/server";
import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  toPublicErrorMessage,
} from "@/lib/errors";
import { startSupportSessionSchema } from "@/lib/validation/organization";
import type { AdminMutationState } from "@/lib/admin/provision";

export type ActiveSupportSession = {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  reason: string | null;
  startedAt: string;
  expiresAt: string;
};

function publicSupportError(error: unknown) {
  if (error instanceof ValidationError || error instanceof AppError) {
    return error.message;
  }

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message: unknown }).message)
        : "";

  if (/support reason is required/i.test(message)) {
    return "Enter a short reason before starting support mode.";
  }

  if (/not authorized/i.test(message)) {
    return "Platform administrator access is required.";
  }

  if (/organization not found/i.test(message)) {
    return "That organization does not exist.";
  }

  return toPublicErrorMessage(error);
}

function isSessionActive(row: {
  ended_at: string | null;
  expires_at: string;
}) {
  if (row.ended_at) {
    return false;
  }

  return new Date(row.expires_at).getTime() > Date.now();
}

async function writeSupportCookie(sessionId: string, expiresAt: string) {
  const store = await cookies();
  const expires = new Date(expiresAt);

  store.set(SUPPORT_SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

async function clearSupportCookie() {
  const store = await cookies();

  try {
    store.delete(SUPPORT_SESSION_COOKIE);
  } catch {
    store.set(SUPPORT_SESSION_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: new Date(0),
    });
  }
}

export async function getActiveSupportSession(): Promise<ActiveSupportSession | null> {
  const admin = await requirePlatformAdmin();
  const store = await cookies();
  const sessionId = store.get(SUPPORT_SESSION_COOKIE)?.value;

  if (!sessionId) {
    return null;
  }

  const privileged = createServiceRoleClient();
  const { data, error } = await privileged
    .from("support_sessions")
    .select(
      "id, organization_id, reason, started_at, expires_at, ended_at, organizations(name, slug)",
    )
    .eq("id", sessionId)
    .eq("platform_admin_user_id", admin.user.id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  if (!isSessionActive(data)) {
    return null;
  }

  const organization = Array.isArray(data.organizations)
    ? data.organizations[0]
    : data.organizations;

  if (!organization) {
    return null;
  }

  return {
    id: data.id,
    organizationId: data.organization_id,
    organizationName: organization.name,
    organizationSlug: organization.slug,
    reason: data.reason,
    startedAt: data.started_at,
    expiresAt: data.expires_at,
  };
}

export async function startSupportSession(input: {
  organizationId: string;
  reason: string;
  confirm?: string;
}) {
  const admin = await requirePlatformAdmin();
  const parsed = startSupportSessionSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError(
      "Confirm support mode and enter a short reason before continuing.",
    );
  }

  const scoped = await createSupabaseServerClient();
  const { data, error } = await scoped.rpc("start_support_session", {
    p_organization_id: parsed.data.organizationId,
    p_reason: parsed.data.reason,
    p_duration_minutes: SUPPORT_SESSION_DURATION_MINUTES,
  });

  if (error || !data) {
    throw new AppError(
      "support_session_start_failed",
      publicSupportError(error ?? new Error("Unable to start support mode.")),
      400,
    );
  }

  const privileged = createServiceRoleClient();
  const { data: session, error: sessionError } = await privileged
    .from("support_sessions")
    .select("id, expires_at")
    .eq("id", data)
    .eq("platform_admin_user_id", admin.user.id)
    .maybeSingle();

  if (sessionError || !session) {
    throw new AppError(
      "support_session_start_failed",
      "Support mode started but the session could not be loaded.",
      500,
    );
  }

  await writeSupportCookie(session.id, session.expires_at);

  return {
    sessionId: session.id,
    organizationId: parsed.data.organizationId,
  };
}

export async function endSupportSession(sessionId?: string) {
  await requirePlatformAdmin();
  const store = await cookies();
  const id = sessionId || store.get(SUPPORT_SESSION_COOKIE)?.value;

  if (!id) {
    await clearSupportCookie();
    return;
  }

  const scoped = await createSupabaseServerClient();
  const { error } = await scoped.rpc("end_support_session", {
    p_session_id: id,
  });

  if (error && !/not found/i.test(error.message)) {
    throw new AppError(
      "support_session_end_failed",
      publicSupportError(error),
      400,
    );
  }

  await clearSupportCookie();
}

export async function startSupportSessionAction(
  _previous: AdminMutationState,
  formData: FormData,
): Promise<AdminMutationState> {
  const organizationId = String(formData.get("organizationId") ?? "");

  try {
    await startSupportSession({
      organizationId,
      reason: String(formData.get("reason") ?? ""),
      confirm: String(formData.get("confirm") ?? ""),
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    if (error instanceof AuthorizationError) {
      return { error: "Platform administrator access is required." };
    }

    return { error: publicSupportError(error) };
  }

  redirect("/app");
}

export async function endSupportSessionAction(
  _previous: AdminMutationState,
  formData: FormData,
): Promise<AdminMutationState> {
  const organizationId = String(formData.get("organizationId") ?? "");

  try {
    await endSupportSession(String(formData.get("sessionId") ?? "") || undefined);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    if (error instanceof AuthorizationError) {
      return { error: "Platform administrator access is required." };
    }

    return { error: publicSupportError(error) };
  }

  if (organizationId) {
    redirect(`${adminClientPath(organizationId)}?notice=support-ended`);
  }

  redirect("/admin/clients");
}
