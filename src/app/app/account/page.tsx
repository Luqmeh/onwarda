import { ClientPageHeader, ClientSectionCard } from "@/components/workspace/client-ui";
import { PasswordChangeForm } from "@/components/auth/password-change-form";
import { requireWorkspaceView } from "@/lib/tenancy/workspace-access";

export const metadata = {
  title: "Account",
};

export default async function ClientAccountPage() {
  const view = await requireWorkspaceView();
  const organization = view.context.organization;
  const role =
    view.kind === "support" ? "support" : view.context.membership.role;

  return (
    <div className="space-y-6">
      <ClientPageHeader
        kicker="You"
        title="Account"
        description="Your access to this organization. Platform administration is a separate product."
      />
      <ClientSectionCard title="Profile">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-onwarda-muted">Name</dt>
            <dd className="mt-1 font-medium">{view.context.profile?.full_name || "—"}</dd>
          </div>
          <div>
            <dt className="text-onwarda-muted">Email</dt>
            <dd className="mt-1 font-medium">
              {view.context.user.email ?? view.context.profile?.email ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-onwarda-muted">Organization</dt>
            <dd className="mt-1 font-medium">{organization.name}</dd>
          </div>
          <div>
            <dt className="text-onwarda-muted">Access</dt>
            <dd className="mt-1 font-medium capitalize">{role}</dd>
          </div>
        </dl>
      </ClientSectionCard>
      <ClientSectionCard
        title="Security"
        description="Change the password for this signed-in account. This does not change organization access."
      >
        <PasswordChangeForm audience="client" />
      </ClientSectionCard>
    </div>
  );
}
