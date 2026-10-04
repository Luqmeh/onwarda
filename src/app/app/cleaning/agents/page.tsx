import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ClientPageHeader, ClientSectionCard, ClientStatusBadge } from "@/components/workspace/client-ui";
import { CreateCleanerForm } from "@/components/workspace/cleaning-forms";
import { CLIENT_ROUTES, canManageCleaning, cleaningAgentPath } from "@/config/client";
import { listCleaningAgents } from "@/lib/cleaning/load";
import { requireWorkspaceView } from "@/lib/tenancy/workspace-access";

export const metadata = { title: "Cleaning team" };

export default async function CleaningAgentsPage() {
  const view = await requireWorkspaceView();
  const canManage = view.kind === "membership" && canManageCleaning(view.context.membership.role);
  const agents = await listCleaningAgents();

  return (
    <div className="space-y-6">
      <ClientPageHeader
        kicker="Turnover"
        title="Cleaning team"
        description="Each cleaner has one permanent link for every property they are assigned."
        actions={
          <Button asChild variant="outline">
            <Link href={CLIENT_ROUTES.cleaning}>Active cleaning</Link>
          </Button>
        }
      />
      <ClientSectionCard title="Cleaners">
        {agents.length === 0 ? (
          <p className="text-sm text-onwarda-muted">No cleaners yet.</p>
        ) : (
          <ul className="space-y-3">
            {agents.map((agent) => (
              <li key={agent.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
                <div>
                  <p className="font-medium">{agent.name}</p>
                  <p className="text-sm text-onwarda-muted">
                    {agent.propertyCount} properties · {agent.activeTaskCount} active cleaning ·{" "}
                    {agent.linkConfigured ? "Permanent link configured" : "No link yet"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <ClientStatusBadge label={agent.active ? "Active" : "Disabled"} tone={agent.active ? "olive" : "neutral"} />
                  <Link href={cleaningAgentPath(agent.id)} className="text-sm font-medium underline underline-offset-4">
                    Open profile
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ClientSectionCard>
      {canManage ? (
        <ClientSectionCard title="Add cleaner">
          <CreateCleanerForm />
        </ClientSectionCard>
      ) : (
        <ClientSectionCard title="Add cleaner">
          <p className="text-sm text-onwarda-muted">Owners, admins, and managers can add cleaners.</p>
        </ClientSectionCard>
      )}
    </div>
  );
}
