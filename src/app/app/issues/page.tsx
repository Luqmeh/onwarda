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

      <ClientSectionCard title="Open and recent">
        {issues.length === 0 ? (
          <ClientEmptyState
            title="Everything is quiet."
            description="When something needs attention in a home, it will show here with its property, priority, and status."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-onwarda-muted">
                <tr>
                  <th className="py-2 font-medium">Issue</th>
                  <th className="py-2 font-medium">Property</th>
                  <th className="py-2 font-medium">Priority</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((issue) => (
                  <tr key={issue.id} className="border-b last:border-0">
                    <td className="py-3">
                      <p className="font-medium capitalize">{humanizeToken(issue.category)}</p>
                      <p className="line-clamp-1 text-onwarda-muted">{issue.description}</p>
                    </td>
                    <td className="py-3 text-onwarda-muted">{issue.propertyName ?? "—"}</td>
                    <td className="py-3">
                      <ClientStatusBadge label={issue.priority} tone={statusTone(issue.priority)} />
                    </td>
                    <td className="py-3">
                      {canUpdate ? (
                        <IssueStatusForm issueId={issue.id} status={issue.status} />
                      ) : (
                        <ClientStatusBadge
                          label={humanizeToken(issue.status)}
                          tone={statusTone(issue.status)}
                        />
                      )}
                    </td>
                    <td className="py-3 text-onwarda-muted">{formatDate(issue.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ClientSectionCard>
    </div>
  );
}
