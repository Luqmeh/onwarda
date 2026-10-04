import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { AssignCleaningTaskForm } from "@/components/workspace/cleaning-forms";
import {
  ClientPageHeader,
  ClientSectionCard,
  ClientStatusBadge,
} from "@/components/workspace/client-ui";
import { CLIENT_ROUTES, canAdministerCleaning, cleaningAgentPath } from "@/config/client";
import {
  CLEANING_CHECKLIST_CATEGORIES,
  CLEANING_TASK_STATUS_LABELS,
  CLEANING_TRIGGER_LABELS,
  PROPERTY_READINESS_LABELS,
  type CleaningTaskStatus,
  type PropertyReadiness,
} from "@/lib/cleaning/catalog";
import { cancelCleaningTaskAction, reopenCleaningTaskAction } from "@/lib/cleaning/actions";
import { getCleaningTaskDetail } from "@/lib/cleaning/load";
import { NotFoundError } from "@/lib/errors";
import { requireWorkspaceView } from "@/lib/tenancy/workspace-access";
import { formatDateTime } from "@/lib/workspace/format";

export const metadata = { title: "Cleaning task" };

export default async function CleaningTaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ cleaningTaskId: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { cleaningTaskId } = await params;
  const view = await requireWorkspaceView();
  const canAdminister =
    view.kind === "membership" && canAdministerCleaning(view.context.membership.role);

  let task;

  try {
    task = await getCleaningTaskDetail(cleaningTaskId);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }

    throw error;
  }

  const query = await searchParams;
  const duration =
    task.startedAt && task.completedAt
      ? Math.max(
          1,
          Math.round(
            (new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime()) / 60000,
          ),
        )
      : null;

  return (
    <div className="space-y-6">
      <ClientPageHeader
        kicker="Turnover"
        title={task.propertyName}
        description={
          task.triggerType === "manual"
            ? "Manual cleaning."
            : task.checkedOutAt
              ? `Guest checked out ${formatDateTime(task.checkedOutAt)}.`
              : "Guest checkout cleaning."
        }
        actions={
          <Button asChild variant="outline">
            <Link href={CLIENT_ROUTES.cleaning}>All cleaning</Link>
          </Button>
        }
      />
      {query.notice === "reopened" ? (
        <p className="rounded-lg border bg-onwarda-white px-3 py-2 text-sm" role="status">
          Cleaning reopened. Previous completion stays in the history.
        </p>
      ) : null}
      <ClientSectionCard title="Status">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-onwarda-muted">Task</dt>
            <dd className="mt-1">
              <ClientStatusBadge
                label={CLEANING_TASK_STATUS_LABELS[task.status as CleaningTaskStatus] ?? task.status}
              />
            </dd>
          </div>
          <div>
            <dt className="text-onwarda-muted">Property</dt>
            <dd className="mt-1 font-medium">
              {PROPERTY_READINESS_LABELS[task.readiness as PropertyReadiness] ?? task.readiness}
            </dd>
          </div>
          <div>
            <dt className="text-onwarda-muted">Checklist</dt>
            <dd className="mt-1 font-medium">
              {task.completedCount} / {task.totalCount}
            </dd>
          </div>
          <div>
            <dt className="text-onwarda-muted">Source</dt>
            <dd className="mt-1 font-medium">
              {CLEANING_TRIGGER_LABELS[task.triggerType as keyof typeof CLEANING_TRIGGER_LABELS] ??
                task.triggerType}
            </dd>
          </div>
          <div>
            <dt className="text-onwarda-muted">Assigned</dt>
            <dd className="mt-1 font-medium">
              {!task.assignee ? (
                "Unassigned"
              ) : task.assignee.active ? (
                <Link href={cleaningAgentPath(task.assignee.id)} className="underline underline-offset-4">
                  {task.assignee.name}
                </Link>
              ) : (
                <span>
                  {task.assignee.name}
                  <span className="text-onwarda-muted"> · Cleaner unavailable</span>
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-onwarda-muted">Started</dt>
            <dd className="mt-1 font-medium">{task.startedAt ? formatDateTime(task.startedAt) : "Not started"}</dd>
          </div>
          <div>
            <dt className="text-onwarda-muted">Completed</dt>
            <dd className="mt-1 font-medium">
              {task.completedAt ? formatDateTime(task.completedAt) : "Not completed"}
              {duration ? ` · ${duration} min` : ""}
            </dd>
          </div>
        </dl>
        {task.canManage && (task.status === "queued" || task.status === "in_progress") ? (
          <AssignCleaningTaskForm
            taskId={task.id}
            assigneeId={task.assignee?.active ? task.assignee.id : null}
            unavailable={Boolean(task.assignee && !task.assignee.active)}
            agents={task.agents}
          />
        ) : null}
        {task.history.length > 0 ? (
          <ol className="mt-5 space-y-1 text-sm text-onwarda-muted">
            {task.history.map((entry) => (
              <li key={entry.id}>
                <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
                {" · "}
                {entry.eventType === "cleaning.task_reassigned"
                  ? `Reassigned from ${entry.previousAgentName ?? "Unassigned"} to ${entry.agentName ?? "Unassigned"}`
                  : entry.eventType === "cleaning.task_unassigned"
                    ? "Assignment removed"
                    : entry.eventType === "cleaning.task_assigned"
                      ? `Assigned to ${entry.agentName ?? "a cleaner"}`
                      : entry.eventType === "cleaning.completed"
                        ? "Cleaning completed"
                        : entry.eventType === "cleaning.started"
                          ? "Cleaning started"
                          : entry.eventType === "cleaning.task_created"
                            ? "Cleaning created"
                            : entry.eventType}
              </li>
            ))}
          </ol>
        ) : null}
        {canAdminister ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {task.status === "completed" ? (
              <form action={reopenCleaningTaskAction.bind(null, task.id)}>
                <Button type="submit" variant="outline">
                  Reopen cleaning
                </Button>
              </form>
            ) : null}
            {task.status === "queued" || task.status === "in_progress" ? (
              <form action={cancelCleaningTaskAction.bind(null, task.id)}>
                <Button type="submit" variant="outline">
                  Cancel task
                </Button>
              </form>
            ) : null}
          </div>
        ) : null}
      </ClientSectionCard>
      <ClientSectionCard title="Checklist">
        {CLEANING_CHECKLIST_CATEGORIES.map((category) => {
          const items = task.items.filter((item) => item.category === category.key);

          if (items.length === 0) {
            return null;
          }

          return (
            <div key={category.key} className="mb-4">
              <h3 className="text-sm font-medium text-onwarda-muted">{category.label}</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {items.map((item) => (
                  <li key={item.item_key}>
                    {item.completed_at ? "☑" : "☐"} {item.label}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </ClientSectionCard>
    </div>
  );
}
