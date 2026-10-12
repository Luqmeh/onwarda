import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ClientPageHeader, ClientSectionCard } from "@/components/workspace/client-ui";
import { AssignPropertyForm, CleaningLinkForm } from "@/components/workspace/cleaning-forms";
import {
  CLIENT_ROUTES,
  canAdministerCleaning,
  canManageCleaning,
  cleaningTaskPath,
} from "@/config/client";
import {
  setCleaningAgentActiveAction,
  unassignCleaningPropertyAction,
} from "@/lib/cleaning/actions";
import { getCleaningAgentDetail } from "@/lib/cleaning/load";
import { NotFoundError } from "@/lib/errors";
import { getRequestI18n } from "@/i18n/get-locale";
import { clientMetadata } from "@/i18n/page-title";
import { requireWorkspaceView } from "@/lib/tenancy/workspace-access";
import { formatDateTime } from "@/lib/workspace/format";

export async function generateMetadata() {
  return clientMetadata((messages) => ({ title: messages.titles.cleaningTeam }));
}

function taskPropertyName(
  value: { name?: string } | { name?: string }[] | null,
  fallback: string,
) {
  if (Array.isArray(value)) {
    return value[0]?.name ?? fallback;
  }

  return value?.name ?? fallback;
}

export default async function CleaningAgentPage({
  params,
  searchParams,
}: {
  params: Promise<{ cleaningAgentId: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { cleaningAgentId } = await params;
  const [{ messages }, view] = await Promise.all([getRequestI18n(), requireWorkspaceView()]);
  const canManage = view.kind === "membership" && canManageCleaning(view.context.membership.role);
  const canAdminister =
    view.kind === "membership" && canAdministerCleaning(view.context.membership.role);

  let agent;

  try {
    agent = await getCleaningAgentDetail(cleaningAgentId);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }

    throw error;
  }

  const query = await searchParams;

  return (
    <div className="space-y-6">
      <ClientPageHeader
        kicker={messages.screens.cleaningTeam}
        title={agent.name}
        description={agent.active ? messages.screens.activeProfile : messages.screens.disabledProfile}
        actions={
          <Button asChild variant="outline">
            <Link href={CLIENT_ROUTES.cleaningAgents}>{messages.screens.cleaningTeam}</Link>
          </Button>
        }
      />
      {query.notice ? (
        <p className="rounded-lg border bg-onwarda-white px-3 py-2 text-sm" role="status">
          {query.notice === "disabled" ? messages.screens.cleanerDisabled : messages.screens.cleanerEnabled}
        </p>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <ClientSectionCard title={messages.screens.permanentLink}>
          <p className="text-sm text-onwarda-muted">
            {agent.linkConfigured ? messages.screens.linkConfigured : messages.screens.noActiveLink}
          </p>
          {canAdminister ? <div className="mt-4"><CleaningLinkForm agentId={agent.id} /></div> : null}
          {canAdminister ? (
            <form
              className="mt-4"
              action={setCleaningAgentActiveAction.bind(null, agent.id, !agent.active)}
            >
              <Button type="submit" variant="outline">
                {agent.active ? messages.screens.disableCleaner : messages.screens.enableCleaner}
              </Button>
            </form>
          ) : null}
        </ClientSectionCard>
        <ClientSectionCard title={messages.screens.assignedProperties}>
          {agent.assignments.length === 0 ? (
            <p className="text-sm text-onwarda-muted">{messages.screens.noPropertiesAssigned}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {agent.assignments.map((assignment) => (
                <li key={assignment.propertyId} className="flex items-center justify-between gap-3">
                  <span>{assignment.propertyName}</span>
                  {canManage ? (
                    <form action={unassignCleaningPropertyAction.bind(null, agent.id, assignment.propertyId)}>
                      <Button type="submit" variant="outline" size="sm">
                        {messages.catalog.remove}
                      </Button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {canManage ? (
            <div className="mt-4">
              <AssignPropertyForm agentId={agent.id} properties={agent.availableProperties} />
            </div>
          ) : null}
        </ClientSectionCard>
      </div>
      <ClientSectionCard title="Tasks">
        {agent.activeTasks.length === 0 && agent.completedTasks.length === 0 ? (
          <p className="text-sm text-onwarda-muted">No cleaning tasks for the assigned properties.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {agent.activeTasks.map((task) => (
              <li key={task.id}>
                <Link href={cleaningTaskPath(task.id)} className="font-medium underline underline-offset-4">
                  {taskPropertyName(task.properties, messages.copy.property)}
                </Link>{" "}
                · {task.status.replaceAll("_", " ")}
              </li>
            ))}
            {agent.completedTasks.map((task) => (
              <li key={task.id}>
                <Link href={cleaningTaskPath(task.id)} className="underline underline-offset-4">
                  {taskPropertyName(task.properties, messages.copy.property)}
                </Link>
                {task.completed_at ? ` · completed ${formatDateTime(task.completed_at)}` : " · completed"}
              </li>
            ))}
          </ul>
        )}
      </ClientSectionCard>
    </div>
  );
}
