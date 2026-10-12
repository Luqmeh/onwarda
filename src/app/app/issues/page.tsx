import { IssueStatusForm } from "@/components/workspace/issue-status-form";
import {
  ClientEmptyState,
  ClientPageHeader,
  ClientSectionCard,
  ClientStatusBadge,
} from "@/components/workspace/client-ui";
import { canWriteIssues } from "@/config/client";
import { getRequestI18n } from "@/i18n/get-locale";
import { clientMetadata } from "@/i18n/page-title";
import { formattingLocale } from "@/i18n/locale";
import { requireWorkspaceView } from "@/lib/tenancy/workspace-access";
import { listWorkspaceIssues } from "@/lib/workspace/data";
import { formatDate, humanizeToken, statusTone } from "@/lib/workspace/format";

export async function generateMetadata() {
  return clientMetadata((messages) => ({ title: messages.titles.issues }));
}

export default async function ClientIssuesPage() {
  const [{ locale, messages }, view, issues] = await Promise.all([
    getRequestI18n(),
    requireWorkspaceView(),
    listWorkspaceIssues(),
  ]);
  const dates = formattingLocale(locale);
  const canUpdate =
    view.kind === "membership" && canWriteIssues(view.context.membership.role);

  return (
    <div className="space-y-6">
      <ClientPageHeader
        kicker={messages.screens.operations}
        title={messages.nav.issues}
        description={messages.screens.issuesIntro}
      />

      {issues.length === 0 ? (
        <ClientSectionCard title={messages.screens.houseMatters}>
          <ClientEmptyState
            title={messages.screens.quiet}
            description={messages.screens.issuesListEmpty}
          />
        </ClientSectionCard>
      ) : (
        <ul className="space-y-3">
          {issues.map((issue) => (
            <li key={issue.id} className="client-surface p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium capitalize">{humanizeToken(issue.category)}</p>
                  <p className="mt-1 text-sm text-onwarda-muted">{issue.description}</p>
                  <p className="mt-2 text-sm text-onwarda-muted">
                    <bdi>{issue.propertyName ?? messages.copy.workspace}</bdi> · {formatDate(issue.createdAt, dates)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ClientStatusBadge label={issue.priority} tone={statusTone(issue.priority)} />
                  {canUpdate ? (
                    <IssueStatusForm issueId={issue.id} status={issue.status} />
                  ) : (
                    <ClientStatusBadge label={humanizeToken(issue.status)} tone={statusTone(issue.status)} />
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
