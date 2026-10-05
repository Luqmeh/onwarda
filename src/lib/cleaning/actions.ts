"use server";

import { redirect } from "next/navigation";

import { cleanerProfileUrl } from "@/config/app";
import { getAppUrl } from "@/lib/url";
import { cleaningAgentPath, cleaningTaskPath, CLIENT_ROUTES } from "@/config/client";
import { manualCleaningDraft } from "@/lib/cleaning/assignment";
import { recordCleaningEvent } from "@/lib/cleaning/events";
import { generateCleanerToken } from "@/lib/cleaning/tokens";
import { DOMAIN_EVENT_TYPES } from "@/lib/events/types";
import { ORGANIZATION_ADMIN_ROLES, ORGANIZATION_OPERATIONAL_ROLES } from "@/lib/authorization/roles";
import { createSupabaseServerClient } from "@/lib/database/server";
import {
  AuthenticationError,
  AuthorizationError,
  TenantIsolationError,
  toPublicErrorMessage,
} from "@/lib/errors";
import { requireOrganizationRole } from "@/lib/tenancy/context";
import {
  assignCleaningAgentSchema,
  assignCleaningTaskSchema,
  createCleaningAgentSchema,
  createManualCleaningSchema,
} from "@/lib/validation/cleaning";

export type CleaningMutationState = {
  error?: string;
  link?: string;
  conflictTaskId?: string;
};

function publicError(error: unknown) {
  if (
    error instanceof AuthorizationError ||
    error instanceof TenantIsolationError
  ) {
    return error.message;
  }

  const message = error instanceof Error ? error.message : "";

  if (/not authorized/i.test(message)) {
    return "You do not have permission to change cleaning for this organization.";
  }

  if (/duplicate|unique/i.test(message)) {
    return "That cleaner is already assigned to this property.";
  }

  if (/organization mismatch/i.test(message)) {
    return "That property and cleaner must belong to the same organization.";
  }

  if (/cleaner unavailable/i.test(message)) {
    return "Choose an active cleaner in this organization.";
  }

  if (/already has an active|conflict/i.test(message)) {
    return "This property already has an active cleaning task.";
  }

  return toPublicErrorMessage(error);
}

export async function createCleaningAgentAction(
  _previous: CleaningMutationState,
  formData: FormData,
): Promise<CleaningMutationState> {
  const parsed = createCleaningAgentSchema.safeParse({
    displayName: formData.get("displayName"),
    notes: String(formData.get("notes") ?? ""),
  });

  if (!parsed.success) {
    return { error: "Enter a cleaner name." };
  }

  let agentId = "";

  try {
    const context = await requireOrganizationRole(ORGANIZATION_OPERATIONAL_ROLES);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("cleaning_agents")
      .insert({
        organization_id: context.organization.id,
        display_name: parsed.data.displayName,
        notes: parsed.data.notes ?? null,
        active: true,
      })
      .select("id")
      .maybeSingle();

    if (error || !data) {
      return { error: "Unable to create this cleaner." };
    }

    agentId = data.id;
    await recordCleaningEvent({
      organizationId: context.organization.id,
      actorUserId: context.user.id,
      eventType: DOMAIN_EVENT_TYPES.CLEANING_AGENT_CREATED,
      metadata: { agentId },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    return { error: publicError(error) };
  }

  redirect(cleaningAgentPath(agentId));
}

export async function assignCleaningPropertyAction(
  agentId: string,
  _previous: CleaningMutationState,
  formData: FormData,
): Promise<CleaningMutationState> {
  const parsed = assignCleaningAgentSchema.safeParse({
    propertyId: formData.get("propertyId"),
    cleaningAgentId: agentId,
  });

  if (!parsed.success) {
    return { error: "Choose a property in this organization." };
  }

  try {
    const context = await requireOrganizationRole(ORGANIZATION_OPERATIONAL_ROLES);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("property_cleaning_agents").upsert(
      {
        organization_id: context.organization.id,
        property_id: parsed.data.propertyId,
        cleaning_agent_id: parsed.data.cleaningAgentId,
        active: true,
      },
      { onConflict: "property_id,cleaning_agent_id" },
    );

    if (error) {
      return { error: publicError(error) };
    }

    await recordCleaningEvent({
      organizationId: context.organization.id,
      actorUserId: context.user.id,
      eventType: DOMAIN_EVENT_TYPES.CLEANING_PROPERTY_ASSIGNED,
      propertyId: parsed.data.propertyId,
      metadata: { agentId },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    return { error: publicError(error) };
  }

  redirect(cleaningAgentPath(agentId));
}

export async function unassignCleaningPropertyAction(
  agentId: string,
  propertyId: string,
): Promise<void> {
  const context = await requireOrganizationRole(ORGANIZATION_OPERATIONAL_ROLES);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("property_cleaning_agents")
    .update({ active: false })
    .eq("organization_id", context.organization.id)
    .eq("cleaning_agent_id", agentId)
    .eq("property_id", propertyId);

  if (error) {
    throw new AuthorizationError("Unable to remove this property assignment.");
  }

  await recordCleaningEvent({
    organizationId: context.organization.id,
    actorUserId: context.user.id,
    eventType: DOMAIN_EVENT_TYPES.CLEANING_PROPERTY_UNASSIGNED,
    propertyId,
    metadata: { agentId },
  });

  redirect(cleaningAgentPath(agentId));
}

export async function issueCleaningLinkAction(
  agentId: string,
  _previous: CleaningMutationState,
  _formData: FormData,
): Promise<CleaningMutationState> {
  try {
    await requireOrganizationRole(ORGANIZATION_ADMIN_ROLES);
    void _formData;
    const issued = generateCleanerToken();
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("workspace_issue_cleaning_link", {
      p_agent_id: agentId,
      p_token_hash: issued.hash,
    });

    if (error) {
      return { error: publicError(error) };
    }

    return {
      link: cleanerProfileUrl(getAppUrl(), issued.token),
    };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    return { error: publicError(error) };
  }
}

export async function setCleaningAgentActiveAction(
  agentId: string,
  active: boolean,
): Promise<void> {
  await requireOrganizationRole(ORGANIZATION_ADMIN_ROLES);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("workspace_set_cleaning_agent_active", {
    p_agent_id: agentId,
    p_active: active,
  });

  if (error) {
    throw new AuthorizationError("Unable to update this cleaner.");
  }

  redirect(`${cleaningAgentPath(agentId)}?notice=${active ? "enabled" : "disabled"}`);
}

export async function reopenCleaningTaskAction(taskId: string): Promise<void> {
  await requireOrganizationRole(ORGANIZATION_ADMIN_ROLES);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("workspace_reopen_cleaning_task", {
    p_task_id: taskId,
  });

  if (error) {
    throw new AuthorizationError("Unable to reopen this cleaning task.");
  }

  redirect(`${CLIENT_ROUTES.cleaning}/${taskId}?notice=reopened`);
}

function assigneeId(value: string) {
  return value === "unassigned" ? null : value;
}

export async function createManualCleaningAction(
  _previous: CleaningMutationState,
  formData: FormData,
): Promise<CleaningMutationState> {
  const parsed = createManualCleaningSchema.safeParse({
    propertyId: formData.get("propertyId"),
    assignee: formData.get("assignee"),
    requestKey: formData.get("requestKey"),
    confirmExtra: formData.get("confirmExtra") === "true",
  });

  if (!parsed.success) {
    return { error: "Choose a property in this organization." };
  }

  const draft = manualCleaningDraft({
    propertyId: parsed.data.propertyId,
    assigneeId: assigneeId(parsed.data.assignee),
    requestKey: parsed.data.requestKey,
    confirmExtra: parsed.data.confirmExtra,
  });

  let taskId = "";

  try {
    await requireOrganizationRole(ORGANIZATION_OPERATIONAL_ROLES);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("workspace_create_manual_cleaning", {
      p_property_id: draft.propertyId,
      p_assignee: draft.assigneeId,
      p_request_key: draft.requestKey,
      p_confirm_extra: draft.confirmExtra,
    });

    if (error) {
      return { error: publicError(error) };
    }

    const result = data as { status?: string; taskId?: string } | null;

    if (result?.status === "conflict" && result.taskId) {
      return { conflictTaskId: result.taskId };
    }

    if (!result?.taskId) {
      return { error: "Unable to create this cleaning." };
    }

    taskId = result.taskId;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    return { error: publicError(error) };
  }

  redirect(cleaningTaskPath(taskId));
}

export async function assignCleaningTaskAction(
  taskId: string,
  _previous: CleaningMutationState,
  formData: FormData,
): Promise<CleaningMutationState> {
  const parsed = assignCleaningTaskSchema.safeParse({
    assignee: formData.get("assignee"),
  });

  if (!parsed.success) {
    return { error: "Choose a cleaner in this organization." };
  }

  try {
    await requireOrganizationRole(ORGANIZATION_OPERATIONAL_ROLES);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("workspace_assign_cleaning_task", {
      p_task_id: taskId,
      p_assignee: assigneeId(parsed.data.assignee),
    });

    if (error) {
      return { error: publicError(error) };
    }
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    return { error: publicError(error) };
  }

  redirect(cleaningTaskPath(taskId));
}

export async function addPropertyCleanerAction(
  propertyId: string,
  _previous: CleaningMutationState,
  formData: FormData,
): Promise<CleaningMutationState> {
  const parsed = assignCleaningAgentSchema.safeParse({
    propertyId,
    cleaningAgentId: formData.get("cleaningAgentId"),
  });

  if (!parsed.success) {
    return { error: "Choose a cleaner in this organization." };
  }

  try {
    const context = await requireOrganizationRole(ORGANIZATION_OPERATIONAL_ROLES);
    const supabase = await createSupabaseServerClient();
    const { data: existing, error: existingError } = await supabase
      .from("property_cleaning_agents")
      .select("id, active")
      .eq("organization_id", context.organization.id)
      .eq("property_id", parsed.data.propertyId)
      .eq("cleaning_agent_id", parsed.data.cleaningAgentId)
      .maybeSingle();

    if (existingError) {
      return { error: publicError(existingError) };
    }

    if (existing?.active) {
      return { error: "That cleaner is already assigned to this property." };
    }

    const { error } = await supabase.from("property_cleaning_agents").upsert(
      {
        organization_id: context.organization.id,
        property_id: parsed.data.propertyId,
        cleaning_agent_id: parsed.data.cleaningAgentId,
        active: true,
      },
      { onConflict: "property_id,cleaning_agent_id" },
    );

    if (error) {
      return { error: publicError(error) };
    }

    await recordCleaningEvent({
      organizationId: context.organization.id,
      actorUserId: context.user.id,
      eventType: DOMAIN_EVENT_TYPES.CLEANING_PROPERTY_ASSIGNED,
      propertyId: parsed.data.propertyId,
      metadata: { agentId: parsed.data.cleaningAgentId },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    return { error: publicError(error) };
  }

  redirect(CLIENT_ROUTES.cleaning);
}

export async function removePropertyCleanerAction(propertyId: string, agentId: string): Promise<void> {
  const context = await requireOrganizationRole(ORGANIZATION_OPERATIONAL_ROLES);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("property_cleaning_agents")
    .update({ active: false })
    .eq("organization_id", context.organization.id)
    .eq("property_id", propertyId)
    .eq("cleaning_agent_id", agentId);

  if (error) {
    throw new AuthorizationError("Unable to remove this cleaner from the property.");
  }

  await recordCleaningEvent({
    organizationId: context.organization.id,
    actorUserId: context.user.id,
    eventType: DOMAIN_EVENT_TYPES.CLEANING_PROPERTY_UNASSIGNED,
    propertyId,
    metadata: { agentId },
  });

  redirect(CLIENT_ROUTES.cleaning);
}

export async function cancelCleaningTaskAction(taskId: string): Promise<void> {
  await requireOrganizationRole(ORGANIZATION_ADMIN_ROLES);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("workspace_cancel_cleaning_task", {
    p_task_id: taskId,
  });

  if (error) {
    throw new AuthorizationError("Unable to cancel this cleaning task.");
  }

  redirect(`${CLIENT_ROUTES.cleaning}/${taskId}?notice=cancelled`);
}
