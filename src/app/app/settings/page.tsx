import Link from "next/link";

import {
  ClientPageHeader,
  ClientSectionCard,
  ClientStatusBadge,
} from "@/components/workspace/client-ui";
import { WorkspaceBrandingForm } from "@/components/workspace/workspace-branding-form";
import { CLIENT_ROUTES, canManageWorkspace } from "@/config/client";
import { loadWorkspaceBranding } from "@/lib/branding/load";
import { getRequestI18n } from "@/i18n/get-locale";
import { clientMetadata } from "@/i18n/page-title";
import { requireWorkspaceView } from "@/lib/tenancy/workspace-access";
import { listWorkspaceMembers } from "@/lib/workspace/data";
import { statusTone } from "@/lib/workspace/format";

export async function generateMetadata() {
  return clientMetadata((messages) => ({ title: messages.titles.settings }));
}

export default async function ClientSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const [{ messages }, view] = await Promise.all([
    getRequestI18n(),
    requireWorkspaceView(),
  ]);
  const canManage =
    view.kind === "membership" && canManageWorkspace(view.context.membership.role);

  if (view.kind === "membership" && !canManage) {
    return (
      <ClientSectionCard title={messages.nav.settings}>
        <p className="text-sm text-onwarda-muted">
          Workspace settings are available to owners and admins.
        </p>
      </ClientSectionCard>
    );
  }

  const organization = view.context.organization;
  const branding = await loadWorkspaceBranding(view);
  const members = await listWorkspaceMembers();
  const query = await searchParams;
  const settingNotices: Record<string, string> = {
    "branding-updated": messages.screens.brandingUpdated,
    "branding-logo-removed": messages.screens.logoRemoved,
  };
  const notice = query.notice ? settingNotices[query.notice] : null;

  return (
    <div className="space-y-6">
      <ClientPageHeader
        kicker={messages.screens.workspaceKicker}
        title={messages.nav.settings}
        description={messages.screens.settingsIntro}
      />
      {notice ? (
        <p className="rounded-lg border bg-onwarda-white px-3 py-2 text-sm" role="status">
          {notice}
        </p>
      ) : null}
      <ClientSectionCard title={messages.copy.organization}>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-onwarda-muted">Display name</dt>
            <dd className="mt-1 font-medium">{branding.displayName}</dd>
          </div>
          <div>
            <dt className="text-onwarda-muted">Slug</dt>
            <dd className="mt-1 font-medium">{organization.slug}</dd>
          </div>
          <div>
            <dt className="text-onwarda-muted">Status</dt>
            <dd className="mt-1 font-medium capitalize">{organization.status}</dd>
          </div>
          <div>
            <dt className="text-onwarda-muted">Primary</dt>
            <dd className="mt-1 font-medium">{branding.primaryColor}</dd>
          </div>
        </dl>
      </ClientSectionCard>
      {view.kind === "membership" && canManage ? (
        <ClientSectionCard
          title={messages.screens.branding}
          description={messages.screens.brandingHelp}
        >
          <WorkspaceBrandingForm branding={branding} />
        </ClientSectionCard>
      ) : (
        <ClientSectionCard
          title={messages.screens.branding}
          description={messages.screens.brandingReadOnly}
        >
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-onwarda-muted">Display name</dt>
              <dd className="mt-1 font-medium">{branding.displayName}</dd>
            </div>
            <div>
              <dt className="text-onwarda-muted">Primary</dt>
              <dd className="mt-1 font-medium">{branding.primaryColor}</dd>
            </div>
            <div>
              <dt className="text-onwarda-muted">Secondary</dt>
              <dd className="mt-1 font-medium">{branding.secondaryColor}</dd>
            </div>
            <div>
              <dt className="text-onwarda-muted">Accent</dt>
              <dd className="mt-1 font-medium">{branding.accentColor}</dd>
            </div>
          </dl>
        </ClientSectionCard>
      )}
      <ClientSectionCard
        title={messages.nav.billing}
        description={messages.screens.billingLink}
      >
        <Link href={CLIENT_ROUTES.billing} className="text-sm font-medium underline underline-offset-4">
          Open billing
        </Link>
      </ClientSectionCard>
      <ClientSectionCard
        title={messages.screens.members}
        description={messages.screens.membersHelp}
      >
        {members.length === 0 ? (
          <p className="text-sm text-onwarda-muted">No members are attached yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-onwarda-muted">
                <tr>
                  <th className="py-2 font-medium">Name</th>
                  <th className="py-2 font-medium">Email</th>
                  <th className="py-2 font-medium">Role</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id} className="border-b last:border-0">
                    <td className="py-3 font-medium">{member.fullName ?? "—"}</td>
                    <td className="py-3 text-onwarda-muted">{member.email ?? "—"}</td>
                    <td className="py-3 capitalize">{member.role}</td>
                    <td className="py-3">
                      <ClientStatusBadge
                        label={member.status}
                        tone={statusTone(member.status)}
                      />
                    </td>
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
