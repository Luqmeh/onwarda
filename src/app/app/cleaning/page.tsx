import { randomUUID } from "node:crypto";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { CreateCleaningForm, PropertyCleanerForms } from "@/components/workspace/cleaning-forms";
import {
  ClientMetricCard,
  ClientPageHeader,
  ClientSectionCard,
  ClientStatusBadge,
} from "@/components/workspace/client-ui";
import { CLIENT_ROUTES, cleaningTaskPath } from "@/config/client";
import {
  CLEANING_TASK_STATUS_LABELS,
  CLEANING_TRIGGER_LABELS,
  PROPERTY_READINESS_LABELS,
  type CleaningTaskStatus,
  type PropertyReadiness,
} from "@/lib/cleaning/catalog";
import { getCleaningDashboard, type CleaningDashboardTask } from "@/lib/cleaning/load";
import { formatDateTime } from "@/lib/workspace/format";

export const metadata = { title: "Cleaning" };

function assigneeLabel(task: CleaningDashboardTask) {
  if (task.unassigned || !task.assigneeName) {
    return "Unassigned";
  }

  if (task.assigneeUnavailable) {
    return `${task.assigneeName} · unavailable`;
  }

  return task.assigneeName;
}

function sourceLabel(triggerType: string) {
  return CLEANING_TRIGGER_LABELS[triggerType as keyof typeof CLEANING_TRIGGER_LABELS] ?? triggerType;
}

export default async function CleaningDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  const query = await searchParams;
  const dashboard = await getCleaningDashboard();
  const source =
    query.source === "manual" || query.source === "guest_checkout" ? query.source : "all";
  const matches = (task: CleaningDashboardTask) => source === "all" || task.triggerType === source;
  const waiting = dashboard.active.filter((task) => task.status === "queued" && matches(task));
  const underway = dashboard.active.filter((task) => task.status === "in_progress" && matches(task));
  const completed = dashboard.completedToday.filter(matches);

  return (
    <div className="space-y-6">
      <ClientPageHeader
        kicker="Turnover"
        title="Cleaning"
        description="Create a cleaning now, or let guest checkout open one. The property stays on hold until the task is finished."
        actions={
          <Button asChild variant="outline">
            <Link href={CLIENT_ROUTES.cleaningAgents}>Cleaning team</Link>
          </Button>
        }
      />

      {dashboard.canManage ? (
        <ClientSectionCard title="Create cleaning" description="Starts a queued task for one property.">
          <CreateCleaningForm
            requestKey={randomUUID()}
            properties={dashboard.teams.map((team) => ({
              id: team.propertyId,
              name: team.propertyName,
              defaultAgentId: team.defaultAgentId,
            }))}
            agents={dashboard.agents}
          />
        </ClientSectionCard>
      ) : null}

      <nav aria-label="Cleaning source" className="flex flex-wrap gap-2 text-sm">
        {(
          [
            ["all", "All"],
            ["guest_checkout", "Guest checkout"],
            ["manual", "Manual"],
          ] as const
        ).map(([value, label]) => (
          <Link
            key={value}
            href={value === "all" ? CLIENT_ROUTES.cleaning : `${CLIENT_ROUTES.cleaning}?source=${value}`}
            aria-current={source === value ? "true" : undefined}
            className={`rounded-full px-3 py-1 ${
              source === value
                ? "bg-[color-mix(in_srgb,var(--client-primary)_14%,white)] font-medium text-onwarda-charcoal"
                : "text-onwarda-muted"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ClientMetricCard label="Cleaning required" value={dashboard.summary.required} />
        <ClientMetricCard label="In progress" value={dashboard.summary.inProgress} />
        <ClientMetricCard label="Completed today" value={dashboard.summary.completedToday} />
        <ClientMetricCard label="Unassigned" value={dashboard.summary.unassigned} />
      </section>

      <ClientSectionCard title="Needs cleaning">
        {waiting.length === 0 ? (
          <p className="text-sm text-onwarda-muted">Nothing is waiting for a cleaner.</p>
        ) : (
          <ul className="space-y-3">
            {waiting.map((task) => (
              <li key={task.id} className="client-surface px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{task.propertyName}</p>
                    <p className="text-sm text-onwarda-muted">
                      {PROPERTY_READINESS_LABELS[task.readiness as PropertyReadiness] ?? task.readiness}
                      {" · "}
                      {sourceLabel(task.triggerType)}
                      {task.checkedOutAt ? ` · Guest checked out ${formatDateTime(task.checkedOutAt)}` : ""}
                    </p>
                    <p className="mt-1 text-sm">
                      {assigneeLabel(task)} · {task.completedCount} / {task.totalCount}
                    </p>
                  </div>
                  <div className="space-y-2 text-right">
                    <ClientStatusBadge
                      label={CLEANING_TASK_STATUS_LABELS[task.status as CleaningTaskStatus] ?? task.status}
                      tone="neutral"
                    />
                    <div>
                      <Link href={cleaningTaskPath(task.id)} className="text-sm font-medium underline underline-offset-4">
                        Open
                      </Link>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ClientSectionCard>

      <ClientSectionCard title="In progress">
        {underway.length === 0 ? (
          <p className="text-sm text-onwarda-muted">No cleaning is underway.</p>
        ) : (
          <ul className="space-y-3">
            {underway.map((task) => (
              <li key={task.id} className="client-surface px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{task.propertyName}</p>
                    <p className="mt-1 text-sm">
                      {PROPERTY_READINESS_LABELS[task.readiness as PropertyReadiness] ?? "Cleaning in progress"}
                      {" · "}
                      {assigneeLabel(task)} · {task.completedCount} / {task.totalCount}
                    </p>
                  </div>
                  <Link href={cleaningTaskPath(task.id)} className="text-sm font-medium underline underline-offset-4">
                    Open
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ClientSectionCard>

      <ClientSectionCard title="Completed today">
        {completed.length === 0 ? (
          <p className="text-sm text-onwarda-muted">Nothing has been completed today.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {completed.map((task) => (
              <li key={task.id}>
                <Link href={cleaningTaskPath(task.id)} className="font-medium underline underline-offset-4">
                  {task.propertyName}
                </Link>
                {` · ${sourceLabel(task.triggerType)}`}
                {task.completedAt ? ` · ${formatDateTime(task.completedAt)}` : null}
                {` · ${assigneeLabel(task)}`}
              </li>
            ))}
          </ul>
        )}
      </ClientSectionCard>

      <ClientSectionCard
        title="Default cleaners"
        description="Who normally handles each property. Changing this does not move an open task."
      >
        {dashboard.teams.length === 0 ? (
          <p className="text-sm text-onwarda-muted">Properties will appear here once you add one.</p>
        ) : (
          <ul className="space-y-4">
            {dashboard.teams.map((team) => (
              <li key={team.propertyId} className="rounded-[var(--onwarda-radius)] border px-4 py-3">
                <p className="font-medium">{team.propertyName}</p>
                <p className="text-sm text-onwarda-muted">
                  {PROPERTY_READINESS_LABELS[team.readiness as PropertyReadiness] ?? team.readiness}
                </p>
                <div className="mt-3">
                  {dashboard.canManage ? (
                    <PropertyCleanerForms
                      propertyId={team.propertyId}
                      assigned={team.cleaners}
                      available={dashboard.agents.filter(
                        (agent) => !team.cleaners.some((cleaner) => cleaner.id === agent.id),
                      )}
                    />
                  ) : team.cleaners.length === 0 ? (
                    <p className="text-sm text-onwarda-muted">No default cleaners yet.</p>
                  ) : (
                    <p className="text-sm">{team.cleaners.map((cleaner) => cleaner.name).join(", ")}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </ClientSectionCard>
    </div>
  );
}
