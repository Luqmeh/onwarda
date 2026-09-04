import { CreateKnowledgeForm } from "@/components/workspace/knowledge-form";
import {
  ClientEmptyState,
  ClientPageHeader,
  ClientSectionCard,
  ClientStatusBadge,
} from "@/components/workspace/client-ui";
import { ORGANIZATION_OPERATIONAL_ROLES } from "@/lib/authorization/roles";
import { requireWorkspaceView } from "@/lib/tenancy/workspace-access";
import { listWorkspaceKnowledge, listWorkspaceProperties } from "@/lib/workspace/data";
import { humanizeToken, statusTone } from "@/lib/workspace/format";

export const metadata = {
  title: "Knowledge",
};

export default async function ClientKnowledgePage() {
  const [view, entries, properties] = await Promise.all([
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
        kicker="House notes"
        title="Knowledge"
        description="House rules, check-in notes, Wi-Fi, and the small things that make a stay feel considered."
      />

      {canCreate ? (
        <ClientSectionCard
          title="Add knowledge"
          description="Owner, admin, and manager roles can keep property notes here. This is not the guest portal."
        >
          <CreateKnowledgeForm
            properties={properties.map((property) => ({
              id: property.id,
              name: property.name,
            }))}
          />
        </ClientSectionCard>
      ) : null}

      <ClientSectionCard title="Property knowledge">
        {entries.length === 0 ? (
          <ClientEmptyState
            title="Your property knowledge will live here."
            description="This is the foundation for guest instructions, tutorials, FAQs, and house rules."
          />
        ) : (
          <ul className="divide-y">
            {entries.map((entry) => (
              <li key={entry.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
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
