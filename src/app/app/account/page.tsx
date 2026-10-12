import { ClientPageHeader, ClientSectionCard } from "@/components/workspace/client-ui";
import { PasswordChangeForm } from "@/components/auth/password-change-form";
import { getRequestI18n } from "@/i18n/get-locale";
import { clientMetadata } from "@/i18n/page-title";
import { requireWorkspaceView } from "@/lib/tenancy/workspace-access";
import { labeledStatus } from "@/lib/workspace/format";

export async function generateMetadata() {
  return clientMetadata((messages) => ({ title: messages.titles.account }));
}

export default async function ClientAccountPage() {
  const [{ messages }, view] = await Promise.all([
    getRequestI18n(),
    requireWorkspaceView(),
  ]);
  const organization = view.context.organization;
  const role =
    view.kind === "support" ? "support" : view.context.membership.role;

  return (
    <div className="space-y-6">
      <ClientPageHeader
        kicker={messages.copy.accountKicker}
        title={messages.nav.account}
        description={messages.copy.accountDescription}
      />
      <ClientSectionCard title={messages.copy.profile}>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-onwarda-muted">{messages.copy.name}</dt>
            <dd className="mt-1 font-medium"><bdi>{view.context.profile?.full_name || "—"}</bdi></dd>
          </div>
          <div>
            <dt className="text-onwarda-muted">{messages.copy.email}</dt>
            <dd className="mt-1 font-medium" dir="ltr">
              {view.context.user.email ?? view.context.profile?.email ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-onwarda-muted">{messages.copy.organization}</dt>
            <dd className="mt-1 font-medium"><bdi>{organization.name}</bdi></dd>
          </div>
          <div>
            <dt className="text-onwarda-muted">{messages.copy.access}</dt>
            <dd className="mt-1 font-medium">{labeledStatus(role, messages.roles)}</dd>
          </div>
        </dl>
      </ClientSectionCard>
      <ClientSectionCard
        title={messages.copy.security}
        description={messages.copy.securityDescription}
      >
        <PasswordChangeForm audience="client" />
      </ClientSectionCard>
    </div>
  );
}
