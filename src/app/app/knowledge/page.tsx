import { CreateKnowledgeForm } from "@/components/workspace/knowledge-form";
import {
  ClientEmptyState,
  ClientPageHeader,
  ClientSectionCard,
  ClientStatusBadge,
} from "@/components/workspace/client-ui";
import { ORGANIZATION_OPERATIONAL_ROLES } from "@/lib/authorization/roles";
import { getRequestI18n } from "@/i18n/get-locale";
import { clientMetadata } from "@/i18n/page-title";
import { requireWorkspaceView } from "@/lib/tenancy/workspace-access";
import { listWorkspaceKnowledge, listWorkspaceProperties } from "@/lib/workspace/data";
import { humanizeToken, statusTone } from "@/lib/workspace/format";

export async function generateMetadata() {
  return clientMetadata((messages) => ({ title: messages.titles.knowledge }));
}

export default async function ClientKnowledgePage() {
  const [{ messages }, view, entries, properties] = await Promise.all([
    getRequestI18n(),
    requireWorkspaceView(),
    listWorkspaceKnowledge(),
    listWorkspaceProperties(),
  ]);
  const canCreate =
    view.kind === "membership" &&
    ORGANIZATION_OPERATIONAL_ROLES.includes(view.context.membership.role);

  return (
    <div className="space-y-6">
      <ClientPageHeader
        kicker={messages.screens.houseNotes}
        title={messages.nav.knowledge}
        description={messages.screens.knowledgeIntro}
      />

      {canCreate ? (
        <ClientSectionCard
          title={messages.screens.addKnowledge}
          description={messages.screens.addKnowledgeHelp}
        >
          <CreateKnowledgeForm
            properties={properties.map((property) => ({
              id: property.id,
              name: property.name,
            }))}
          />
        </ClientSectionCard>
      ) : null}

      <ClientSectionCard title={messages.screens.propertyKnowledge}>
        {entries.length === 0 ? (
          <ClientEmptyState
            title={messages.screens.knowledgeEmpty}
            description={messages.screens.knowledgeEmptyBody}
          />
        ) : (
          <ul className="divide-y">
            {entries.map((entry) => (
              <li key={entry.id} className="flex flex-col gap-2 border-b border-onwarda-olive/10 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{entry.title || humanizeToken(entry.category)}</p>
                  <p className="text-sm capitalize text-onwarda-muted">
                    {humanizeToken(entry.category)}
                    {entry.propertyName ? ` · ${entry.propertyName}` : ""}
                  </p>
                </div>
                <ClientStatusBadge label={entry.status} tone={statusTone(entry.status)} />
              </li>
            ))}
          </ul>
        )}
      </ClientSectionCard>
    </div>
  );
}
