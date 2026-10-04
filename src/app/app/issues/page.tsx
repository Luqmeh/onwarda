import { IssueStatusForm } from "@/components/workspace/issue-status-form";
import {
  ClientEmptyState,
  ClientPageHeader,
  ClientSectionCard,
  ClientStatusBadge,
} from "@/components/workspace/client-ui";
import { canWriteIssues } from "@/config/client";
import { requireWorkspaceView } from "@/lib/tenancy/workspace-access";
import { listWorkspaceIssues } from "@/lib/workspace/data";
import { formatDate, humanizeToken, statusTone } from "@/lib/workspace/format";

export const metadata = {
  title: "Issues",
};

export default async function ClientIssuesPage() {
  const [view, issues] = await Promise.all([
    requireWorkspaceView(),
    listWorkspaceIssues(),
  ]);
  const canUpdate =
    view.kind === "membership" && canWriteIssues(view.context.membership.role);

  return (
    <div className="space-y-6">
      <ClientPageHeader
        kicker="Operations"
        title="Issues"
        description="Housekeeping, access, and guest requests for this organization. Permission to change an issue is enforced on the server, not by this page."
      />

      {issues.length === 0 ? (
        <ClientSectionCard title="House matters">
          <ClientEmptyState
            title="Everything is quiet."
            description="When a home needs attention, it will show here with its property, priority, and status."
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
                    {issue.propertyName ?? "Workspace"} · {formatDate(issue.createdAt)}
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
