import "server-only";

import { selectDefaultCleaner } from "@/lib/cleaning/assignment";
import { canManageCleaning } from "@/config/client";
import { createSupabaseServerClient } from "@/lib/database/server";
import { AppError, NotFoundError } from "@/lib/errors";
import { requireWorkspaceView } from "@/lib/tenancy/workspace-access";

function fail(message: string): never {
  throw new AppError("cleaning_unavailable", message, 500);
}

type Embedded<T> = T | T[] | null;

function first<T>(value: Embedded<T>) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

export type CleaningDashboardTask = {
  id: string;
  status: string;
  triggerType: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  propertyId: string;
  propertyName: string;
  readiness: string;
  checkedOutAt: string | null;
  completedCount: number;
  totalCount: number;
  assigneeName: string | null;
  assigneeUnavailable: boolean;
  unassigned: boolean;
};

export type CleaningPropertyTeam = {
  propertyId: string;
  propertyName: string;
  readiness: string;
  defaultAgentId: string | null;
  cleaners: Array<{ id: string; name: string }>;
};

export async function getCleaningDashboard() {
  const view = await requireWorkspaceView();
  const organizationId = view.context.organization.id;
  const supabase = await createSupabaseServerClient();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [tasksResult, assignmentsResult, propertiesResult, agentsResult] = await Promise.all([
    supabase
      .from("cleaning_tasks")
      .select(
        "id, status, trigger_type, created_at, started_at, completed_at, property_id, assigned_agent_id, properties(name, operational_readiness), reservations(checkout_completed_at), assignee:cleaning_agents!cleaning_tasks_assigned_agent_id_fkey(display_name, active), cleaning_task_items(required, completed_at)",
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("property_cleaning_agents")
      .select("id, property_id, cleaning_agent_id, active, created_at, cleaning_agents(display_name, active)")
      .eq("organization_id", organizationId),
    supabase
      .from("properties")
      .select("id, name, operational_readiness, status")
      .eq("organization_id", organizationId)
      .in("status", ["draft", "active", "inactive"])
      .order("name"),
    supabase
      .from("cleaning_agents")
      .select("id, display_name")
      .eq("organization_id", organizationId)
      .eq("active", true)
      .order("display_name"),
  ]);

  if (tasksResult.error || assignmentsResult.error || propertiesResult.error || agentsResult.error) {
    fail("Unable to load cleaning.");
  }

  const teamsByProperty = new Map<string, CleaningPropertyTeam["cleaners"]>();
  const defaultsByProperty = new Map<string, ReturnType<typeof selectDefaultCleaner>>();
  const assignmentRows = assignmentsResult.data ?? [];

  for (const propertyId of new Set(assignmentRows.map((row) => row.property_id))) {
    const rows = assignmentRows.filter((row) => row.property_id === propertyId && row.active);
    defaultsByProperty.set(
      propertyId,
      selectDefaultCleaner(
        rows
          .filter((row) => first(row.cleaning_agents)?.active)
          .map((row) => ({
            assignmentId: row.id,
            agentId: row.cleaning_agent_id,
            createdAt: row.created_at,
            active: true,
          })),
      ),
    );
  }

  for (const row of assignmentRows) {
    const agent = first(row.cleaning_agents);
    if (!row.active || !agent?.active) {
      continue;
    }

    const current = teamsByProperty.get(row.property_id) ?? [];
    current.push({ id: row.cleaning_agent_id, name: agent.display_name });
    teamsByProperty.set(row.property_id, current);
  }

  const tasks: CleaningDashboardTask[] = (tasksResult.data ?? []).map((row) => {
    const property = first(row.properties);
    const reservation = first(row.reservations);
    const assignee = first(row.assignee);
    const items = row.cleaning_task_items ?? [];
    const required = items.filter((item) => item.required);

    return {
      id: row.id,
      status: row.status,
      triggerType: row.trigger_type,
      createdAt: row.created_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      propertyId: row.property_id,
      propertyName: property?.name ?? "Property",
      readiness: property?.operational_readiness ?? "ready",
      checkedOutAt: reservation?.checkout_completed_at ?? null,
      completedCount: required.filter((item) => item.completed_at).length,
      totalCount: required.length,
      assigneeName: assignee?.display_name ?? null,
      assigneeUnavailable: Boolean(assignee && !assignee.active),
      unassigned: !row.assigned_agent_id,
    };
  });

  const active = tasks.filter((task) => task.status === "queued" || task.status === "in_progress");
  const completedToday = tasks.filter(
    (task) =>
      task.status === "completed" &&
      task.completedAt &&
      new Date(task.completedAt).getTime() >= startOfDay.getTime(),
  );

  const teams: CleaningPropertyTeam[] = (propertiesResult.data ?? []).map((property) => ({
    propertyId: property.id,
    propertyName: property.name,
    readiness: property.operational_readiness,
    defaultAgentId: defaultsByProperty.get(property.id) ?? null,
    cleaners: teamsByProperty.get(property.id) ?? [],
  }));

  return {
    organizationId,
    canManage: view.kind === "membership" && canManageCleaning(view.context.membership.role),
    active,
    completedToday,
    teams,
    agents: (agentsResult.data ?? []).map((agent) => ({
      id: agent.id,
      name: agent.display_name,
    })),
    summary: {
      required: active.filter((task) => task.status === "queued").length,
      inProgress: active.filter((task) => task.status === "in_progress").length,
      completedToday: completedToday.length,
      unassigned: active.filter((task) => task.unassigned).length,
    },
  };
}

export async function getCleaningTaskDetail(taskId: string) {
  const view = await requireWorkspaceView();
  const organizationId = view.context.organization.id;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("cleaning_tasks")
    .select(
      "id, status, trigger_type, created_at, started_at, completed_at, reopened_at, cancelled_at, property_id, reservation_id, assigned_agent_id, properties(name, operational_readiness, city), reservations(checkout_completed_at), assignee:cleaning_agents!cleaning_tasks_assigned_agent_id_fkey(id, display_name, active), cleaning_task_items(item_key, category, label, sort_order, required, completed_at)",
    )
    .eq("organization_id", organizationId)
    .eq("id", taskId)
    .maybeSingle();

  if (error) {
    fail("Unable to load this cleaning task.");
  }

  if (!data) {
    throw new NotFoundError("Cleaning task not found.");
  }

  const [agentsResult, historyResult] = await Promise.all([
    supabase
      .from("cleaning_agents")
      .select("id, display_name, active")
      .eq("organization_id", organizationId)
      .order("display_name"),
    supabase
      .from("events")
      .select("id, event_type, created_at, metadata")
      .eq("organization_id", organizationId)
      .eq("property_id", data.property_id)
      .in("event_type", [
        "cleaning.task_created",
        "cleaning.task_assigned",
        "cleaning.task_reassigned",
        "cleaning.task_unassigned",
        "cleaning.started",
        "cleaning.completed",
      ])
      .order("created_at", { ascending: true })
      .limit(40),
  ]);

  const property = first(data.properties);
  const reservation = first(data.reservations);
  const assignee = first(data.assignee);
  const items = [...(data.cleaning_task_items ?? [])].sort((left, right) => left.sort_order - right.sort_order);
  const required = items.filter((item) => item.required);
  const names = new Map((agentsResult.data ?? []).map((agent) => [agent.id, agent.display_name]));
  const history = (historyResult.data ?? [])
    .filter((event) => {
      const metadata = event.metadata as { taskId?: string } | null;
      return metadata?.taskId === data.id;
    })
    .map((event) => {
      const metadata = event.metadata as { agentId?: string | null; previousAgentId?: string | null } | null;
      return {
        id: event.id,
        eventType: event.event_type,
        createdAt: event.created_at,
        agentName: metadata?.agentId ? names.get(metadata.agentId) ?? "Cleaner" : null,
        previousAgentName: metadata?.previousAgentId
          ? names.get(metadata.previousAgentId) ?? "Cleaner"
          : null,
      };
    });

  return {
    id: data.id,
    status: data.status,
    triggerType: data.trigger_type,
    createdAt: data.created_at,
    startedAt: data.started_at,
    completedAt: data.completed_at,
    reopenedAt: data.reopened_at,
    cancelledAt: data.cancelled_at,
    propertyId: data.property_id,
    reservationId: data.reservation_id,
    propertyName: property?.name ?? "Property",
    city: property?.city ?? null,
    readiness: property?.operational_readiness ?? "ready",
    checkedOutAt: reservation?.checkout_completed_at ?? null,
    completedCount: required.filter((item) => item.completed_at).length,
    totalCount: required.length,
    items,
    assignee: assignee
      ? { id: assignee.id, name: assignee.display_name, active: assignee.active }
      : null,
    agents: (agentsResult.data ?? [])
      .filter((agent) => agent.active)
      .map((agent) => ({ id: agent.id, name: agent.display_name })),
    history,
    canManage: view.kind === "membership" && canManageCleaning(view.context.membership.role),
  };
}

export async function listCleaningAgents() {
  const view = await requireWorkspaceView();
  const organizationId = view.context.organization.id;
  const supabase = await createSupabaseServerClient();
  const [agentsResult, assignmentsResult, tasksResult, linksResult] = await Promise.all([
    supabase
      .from("cleaning_agents")
      .select("id, display_name, active, created_at")
      .eq("organization_id", organizationId)
      .order("display_name"),
    supabase
      .from("property_cleaning_agents")
      .select("cleaning_agent_id, active")
      .eq("organization_id", organizationId)
      .eq("active", true),
    supabase
      .from("cleaning_tasks")
      .select("property_id, status")
      .eq("organization_id", organizationId)
      .in("status", ["queued", "in_progress"]),
    supabase
      .from("cleaning_agent_links")
      .select("cleaning_agent_id, revoked_at")
      .eq("organization_id", organizationId)
      .is("revoked_at", null),
  ]);

  if (agentsResult.error || assignmentsResult.error || tasksResult.error || linksResult.error) {
    fail("Unable to load the cleaning team.");
  }

  const activeTasksByProperty = new Set((tasksResult.data ?? []).map((task) => task.property_id));
  const propertiesByAgent = new Map<string, number>();
  const taskProperties = new Map<string, Set<string>>();

  const { data: assignmentProperties } = await supabase
    .from("property_cleaning_agents")
    .select("cleaning_agent_id, property_id")
    .eq("organization_id", organizationId)
    .eq("active", true);

  for (const row of assignmentProperties ?? []) {
    propertiesByAgent.set(row.cleaning_agent_id, (propertiesByAgent.get(row.cleaning_agent_id) ?? 0) + 1);
    if (activeTasksByProperty.has(row.property_id)) {
      const current = taskProperties.get(row.cleaning_agent_id) ?? new Set<string>();
      current.add(row.property_id);
      taskProperties.set(row.cleaning_agent_id, current);
    }
  }

  const linked = new Set((linksResult.data ?? []).map((link) => link.cleaning_agent_id));

  return (agentsResult.data ?? []).map((agent) => ({
    id: agent.id,
    name: agent.display_name,
    active: agent.active,
    propertyCount: propertiesByAgent.get(agent.id) ?? 0,
    activeTaskCount: taskProperties.get(agent.id)?.size ?? 0,
    linkConfigured: linked.has(agent.id),
  }));
}

export async function getCleaningAgentDetail(agentId: string) {
  const view = await requireWorkspaceView();
  const organizationId = view.context.organization.id;
  const supabase = await createSupabaseServerClient();
  const { data: agent, error } = await supabase
    .from("cleaning_agents")
    .select("id, display_name, active, notes, created_at")
    .eq("organization_id", organizationId)
    .eq("id", agentId)
    .maybeSingle();

  if (error) {
    fail("Unable to load this cleaner.");
  }

  if (!agent) {
    throw new NotFoundError("Cleaner not found.");
  }

  const [assignments, properties, link, tasks] = await Promise.all([
    supabase
      .from("property_cleaning_agents")
      .select("property_id, active, properties(name)")
      .eq("organization_id", organizationId)
      .eq("cleaning_agent_id", agentId),
    supabase
      .from("properties")
      .select("id, name")
      .eq("organization_id", organizationId)
      .order("name"),
    supabase
      .from("cleaning_agent_links")
      .select("id, revoked_at, created_at")
      .eq("organization_id", organizationId)
      .eq("cleaning_agent_id", agentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("cleaning_tasks")
      .select("id, status, completed_at, created_at, property_id, properties(name)")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const assignedIds = new Set(
    (assignments.data ?? []).filter((row) => row.active).map((row) => row.property_id),
  );
  const relevantTasks = (tasks.data ?? []).filter((task) => assignedIds.has(task.property_id));

  return {
    id: agent.id,
    name: agent.display_name,
    active: agent.active,
    notes: agent.notes,
    linkConfigured: Boolean(link.data && !link.data.revoked_at),
    assignments: (assignments.data ?? [])
      .filter((row) => row.active)
      .map((row) => ({
        propertyId: row.property_id,
        propertyName: first(row.properties)?.name ?? "Property",
      })),
    availableProperties: (properties.data ?? []).filter((property) => !assignedIds.has(property.id)),
    activeTasks: relevantTasks.filter((task) => task.status === "queued" || task.status === "in_progress"),
    completedTasks: relevantTasks.filter((task) => task.status === "completed").slice(0, 8),
  };
}

export async function getReservationCleaningStatus(reservationId: string) {
  const view = await requireWorkspaceView();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("cleaning_tasks")
    .select("id, status, properties(operational_readiness)")
    .eq("organization_id", view.context.organization.id)
    .eq("reservation_id", reservationId)
    .maybeSingle();

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    status: data.status,
    readiness: first(data.properties)?.operational_readiness ?? "ready",
  };
}
