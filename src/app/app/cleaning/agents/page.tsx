import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ClientPageHeader, ClientSectionCard, ClientStatusBadge } from "@/components/workspace/client-ui";
import { CreateCleanerForm } from "@/components/workspace/cleaning-forms";
import { CLIENT_ROUTES, canManageCleaning, cleaningAgentPath } from "@/config/client";
import { listCleaningAgents } from "@/lib/cleaning/load";
import { getRequestI18n } from "@/i18n/get-locale";
import { clientMetadata } from "@/i18n/page-title";
import { requireWorkspaceView } from "@/lib/tenancy/workspace-access";

export async function generateMetadata() {
  return clientMetadata((messages) => ({ title: messages.titles.cleaningTeam }));
}

export default async function CleaningAgentsPage() {
  const [{ messages }, view] = await Promise.all([getRequestI18n(), requireWorkspaceView()]);
  const canManage = view.kind === "membership" && canManageCleaning(view.context.membership.role);
  const agents = await listCleaningAgents();

  return (
    <div className="space-y-6">
      <ClientPageHeader
        kicker={messages.screens.turnover}
        title={messages.screens.cleaningTeam}
        description={messages.screens.permanentLink}
        actions={
          <Button asChild variant="outline">
            <Link href={CLIENT_ROUTES.cleaning}>Active cleaning</Link>
          </Button>
        }
      />
      <ClientSectionCard title={messages.screens.cleaningTeam}>
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
                    {agent.linkConfigured ? messages.screens.linkConfigured : messages.screens.noLinkYet}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <ClientStatusBadge label={agent.active ? messages.screens.active : messages.screens.disabled} tone={agent.active ? "olive" : "neutral"} />
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
        <ClientSectionCard title={messages.actions.addCleaner}>
          <CreateCleanerForm />
        </ClientSectionCard>
      ) : (
        <ClientSectionCard title={messages.actions.addCleaner}>
          <p className="text-sm text-onwarda-muted">{messages.screens.managersCanAddCleaners}</p>
        </ClientSectionCard>
      )}
    </div>
  );
}
