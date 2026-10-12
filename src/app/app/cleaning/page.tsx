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
import { getCleaningDashboard, type CleaningDashboardTask } from "@/lib/cleaning/load";
import { getRequestI18n } from "@/i18n/get-locale";
import { clientMetadata } from "@/i18n/page-title";
import { formattingLocale } from "@/i18n/locale";
import { formatDateTime } from "@/lib/workspace/format";

export async function generateMetadata() {
  return clientMetadata((messages) => ({ title: messages.titles.cleaning }));
}

function assigneeLabel(task: CleaningDashboardTask, unassigned: string, unavailable: string) {
  if (task.unassigned || !task.assigneeName) {
    return unassigned;
  }

  if (task.assigneeUnavailable) {
    return `${task.assigneeName} · ${unavailable}`;
  }

  return task.assigneeName;
}

function sourceLabel(triggerType: string, manual: string, checkout: string) {
  if (triggerType === "manual") {
    return manual;
  }

  if (triggerType === "guest_checkout") {
    return checkout;
  }

  return triggerType;
}

export default async function CleaningDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  const query = await searchParams;
  const [{ locale, messages }, dashboard] = await Promise.all([
    getRequestI18n(),
    getCleaningDashboard(),
  ]);
  const dates = formattingLocale(locale);
  const source =
    query.source === "manual" || query.source === "guest_checkout" ? query.source : "all";
  const matches = (task: CleaningDashboardTask) => source === "all" || task.triggerType === source;
  const waiting = dashboard.active.filter((task) => task.status === "queued" && matches(task));
  const underway = dashboard.active.filter((task) => task.status === "in_progress" && matches(task));
  const completed = dashboard.completedToday.filter(matches);

  return (
    <div className="space-y-6">
      <ClientPageHeader
        kicker={messages.screens.turnover}
        title={messages.nav.cleaning}
        description={messages.screens.cleaningIntro}
        actions={
          <Button asChild variant="outline">
            <Link href={CLIENT_ROUTES.cleaningAgents}>Cleaning team</Link>
          </Button>
        }
      />

      {dashboard.canManage ? (
        <ClientSectionCard title={messages.screens.createCleaning} description={messages.screens.createCleaningHelp}>
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

      <nav aria-label={messages.catalog.cleaningSource} className="flex flex-wrap gap-2 text-sm">
        {(
          [
            ["all", messages.catalog.allSources],
            ["guest_checkout", messages.catalog.guest_checkout],
            ["manual", messages.catalog.manual],
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
        <ClientMetricCard label={messages.screens.cleaningRequired} value={dashboard.summary.required} />
        <ClientMetricCard label={messages.screens.inProgress} value={dashboard.summary.inProgress} />
        <ClientMetricCard label={messages.screens.completedToday} value={dashboard.summary.completedToday} />
        <ClientMetricCard label={messages.screens.unassigned} value={dashboard.summary.unassigned} />
      </section>

      <ClientSectionCard title={messages.screens.needsCleaning}>
        {waiting.length === 0 ? (
          <p className="text-sm text-onwarda-muted">{messages.screens.waitingEmpty}</p>
        ) : (
          <ul className="space-y-3">
            {waiting.map((task) => (
              <li key={task.id} className="client-surface px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{task.propertyName}</p>
                    <p className="text-sm text-onwarda-muted">
                      {messages.catalog[task.readiness as keyof typeof messages.catalog] ?? task.readiness}
                      {" · "}
                      {sourceLabel(task.triggerType, messages.catalog.manual, messages.catalog.guest_checkout)}
                      {task.checkedOutAt ? ` · ${formatDateTime(task.checkedOutAt, dates)}` : ""}
                    </p>
                    <p className="mt-1 text-sm">
                      {assigneeLabel(task, messages.screens.unassigned, messages.screens.unavailable)} · {task.completedCount} / {task.totalCount}
                    </p>
                  </div>
                  <div className="space-y-2 text-right">
                    <ClientStatusBadge
                      label={
                        task.status === "queued"
                          ? messages.catalog.queued
                          : task.status === "in_progress"
                            ? messages.status.in_progress
                            : task.status === "completed"
                              ? messages.status.completed
                              : task.status === "cancelled"
                                ? messages.status.cancelled
                                : task.status
                      }
                      tone="neutral"
                    />
                    <div>
                      <Link href={cleaningTaskPath(task.id)} className="text-sm font-medium underline underline-offset-4">
                        {messages.screens.openTask}
                      </Link>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ClientSectionCard>

      <ClientSectionCard title={messages.screens.inProgress}>
        {underway.length === 0 ? (
          <p className="text-sm text-onwarda-muted">{messages.screens.noCleaningUnderway}</p>
        ) : (
          <ul className="space-y-3">
            {underway.map((task) => (
              <li key={task.id} className="client-surface px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{task.propertyName}</p>
                    <p className="mt-1 text-sm">
                      {messages.catalog.cleaningInProgress}
                      {" · "}
                      {assigneeLabel(task, messages.screens.unassigned, messages.screens.unavailable)} · {task.completedCount} / {task.totalCount}
                    </p>
                  </div>
                  <Link href={cleaningTaskPath(task.id)} className="text-sm font-medium underline underline-offset-4">
                    {messages.screens.openTask}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ClientSectionCard>

      <ClientSectionCard title={messages.screens.completedToday}>
        {completed.length === 0 ? (
          <p className="text-sm text-onwarda-muted">{messages.screens.completedEmpty}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {completed.map((task) => (
              <li key={task.id}>
                <Link href={cleaningTaskPath(task.id)} className="font-medium underline underline-offset-4">
                  {task.propertyName}
                </Link>
                {` · ${sourceLabel(task.triggerType, messages.catalog.manual, messages.catalog.guest_checkout)}`}
                {task.completedAt ? ` · ${formatDateTime(task.completedAt, dates)}` : null}
                {` · ${assigneeLabel(task, messages.screens.unassigned, messages.screens.unavailable)}`}
              </li>
            ))}
          </ul>
        )}
      </ClientSectionCard>

      <ClientSectionCard
        title={messages.screens.defaultCleaners}
        description={messages.screens.defaultCleanersHelp}
      >
        {dashboard.teams.length === 0 ? (
          <p className="text-sm text-onwarda-muted">Properties will appear here once you add one.</p>
        ) : (
          <ul className="space-y-4">
            {dashboard.teams.map((team) => (
              <li key={team.propertyId} className="rounded-[var(--onwarda-radius)] border px-4 py-3">
                <p className="font-medium">{team.propertyName}</p>
                <p className="text-sm text-onwarda-muted">
                  {messages.catalog[team.readiness as keyof typeof messages.catalog] ?? team.readiness}
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
