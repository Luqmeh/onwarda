import Link from "next/link";
import { notFound } from "next/navigation";

import { CopyLinkButton } from "@/components/admin/copy-link-button";
import { InviteUserForm } from "@/components/admin/invite-user-form";
import { MemberActions } from "@/components/admin/member-actions";
import { MetricCard } from "@/components/admin/metric-card";
import { OrganizationStatusForm } from "@/components/admin/organization-status-form";
import { StatusBadge } from "@/components/admin/status-badge";
import {
  EnterSupportForm,
  ExitSupportForm,
} from "@/components/admin/support-session-forms";
import { TransferOwnershipForm } from "@/components/admin/transfer-ownership-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ADMIN_ROUTES } from "@/config/admin";
import { getPublicEnv } from "@/config/env";
import { clientAccessPath, clientAccessUrl } from "@/config/app";
import { OrganizationBrandingForm } from "@/components/admin/organization-branding-form";
import { OrganizationSubscriptionForm } from "@/components/admin/subscription-form";
import { getAdminOrganizationBranding } from "@/lib/admin/branding";
import { getAdminOrganization } from "@/lib/admin/organizations";
import { getOrganizationSubscription } from "@/lib/admin/subscriptions";
import { getActiveSupportSession } from "@/lib/admin/support";
import { NotFoundError } from "@/lib/errors";
import { uuidSchema } from "@/lib/validation/common";

export const metadata = {
  title: "Client",
};

const NOTICE_COPY: Record<string, string> = {
  "user-invited": "Invitation sent.",
  "user-attached": "Existing account attached as a member of this organization.",
  "role-updated": "Organization role updated.",
  "membership-updated": "Membership status updated.",
  "ownership-transferred": "Ownership transferred.",
  "support-started": "Support session started. It will expire automatically.",
  "support-ended": "Support session ended.",
  "subscription-updated": "Subscription record updated. Payment processing is not connected yet.",
  "branding-updated": "Organization branding updated.",
  "branding-logo-removed": "Organization logo removed.",
  "branding-failed":
    "Client created. Branding could not be saved. Default branding is in place and can be updated below.",
  updated: "Organization status updated.",
};

export default async function AdminClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{
    created?: string;
    invited?: string;
    status?: string;
    notice?: string;
  }>;
}) {
  const { organizationId } = await params;
  const parsedId = uuidSchema.safeParse(organizationId);

  if (!parsedId.success) {
    notFound();
  }

  let organization;

  try {
    organization = await getAdminOrganization(parsedId.data);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }

    throw error;
  }

  const query = await searchParams;
  const [supportSession, subscription, branding] = await Promise.all([
    getActiveSupportSession(),
    getOrganizationSubscription(parsedId.data),
    getAdminOrganizationBranding(parsedId.data),
  ]);
  const accessUrl = clientAccessUrl(getPublicEnv().NEXT_PUBLIC_APP_URL, organization.slug);
  const created = query.created === "1";
  const invitationSent = query.invited === "1";
  const notice = query.notice || (query.status === "updated" ? "updated" : "");
  const actingOwners = organization.members.filter(
    (member) => member.role === "owner" && member.status !== "suspended",
  );
  const transferCandidates = organization.members.filter(
    (member) =>
      member.role !== "owner" && member.status === "active",
  );
  const supportForThisOrg =
    supportSession?.organizationId === organization.id ? supportSession : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{organization.name}</h1>
            <StatusBadge status={organization.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            Slug {organization.slug} · Created{" "}
            {new Date(organization.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-3 sm:items-end">
          <div className="flex flex-wrap justify-end gap-2">
            <CopyLinkButton value={accessUrl} label="Copy client access link" />
            <Button asChild variant="outline">
              <Link href={ADMIN_ROUTES.clients}>Back to clients</Link>
            </Button>
          </div>
          <OrganizationStatusForm
            organizationId={organization.id}
            status={organization.status}
          />
        </div>
      </div>

      {created ? (
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm" role="status">
          {invitationSent
            ? "Client created and invitation sent."
            : "Client created. The owner already had an account and was attached as owner."}
        </p>
      ) : null}

      {notice && NOTICE_COPY[notice] ? (
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm" role="status">
          {NOTICE_COPY[notice]}
        </p>
      ) : null}

      <section aria-label="Client overview" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Users" value={organization.userCount} emptyLabel="No users yet" />
        <MetricCard
          label="Properties"
          value={organization.propertyCount}
          emptyLabel="No properties yet"
        />
        <MetricCard
          label="Reservations"
          value={organization.reservationCount}
          emptyLabel="No reservations yet"
        />
        <MetricCard label="Guests" value={organization.guestCount} emptyLabel="No guests yet" />
        <MetricCard
          label="Open issues"
          value={organization.openIssueCount}
          emptyLabel="No open issues"
        />
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Organization status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBadge status={organization.status} />
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Owner</CardTitle>
          </CardHeader>
          <CardContent>
            {organization.owner ? (
              <p className="text-sm font-medium">
                {organization.owner.fullName || organization.owner.email || "Owner"}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">No owner on file</p>
            )}
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Last meaningful activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {organization.lastActivityAt ? (
              <p className="text-sm font-medium">
                {new Date(organization.lastActivityAt).toLocaleString()}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">No activity yet</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Client access link</CardTitle>
            <CardDescription>
              Slug is a routing identifier. The organization UUID stays internal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="font-medium">{clientAccessPath(organization.slug)}</p>
            <p className="break-all text-sm text-muted-foreground">{accessUrl}</p>
            <CopyLinkButton value={accessUrl} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Support mode</CardTitle>
            <CardDescription>
              Privileged, time-limited, and audited. It does not create client membership.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {supportForThisOrg ? (
              <div className="space-y-3">
                <p className="text-sm">
                  Active until {new Date(supportForThisOrg.expiresAt).toLocaleString()}.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <Link href="/app">Open client workspace</Link>
                  </Button>
                  <ExitSupportForm
                    organizationId={organization.id}
                    sessionId={supportForThisOrg.id}
                  />
                </div>
              </div>
            ) : (
              <EnterSupportForm
                organizationId={organization.id}
                organizationName={organization.name}
              />
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
          <CardDescription>
            Client workspace identity. The organization remains the tenant. Logos are
            stored privately and are not served as public files.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Display name</dt>
              <dd className="mt-1 font-medium">{branding.displayName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Primary</dt>
              <dd className="mt-1 font-medium">{branding.primaryColor}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Secondary</dt>
              <dd className="mt-1 font-medium">{branding.secondaryColor}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Accent</dt>
              <dd className="mt-1 font-medium">{branding.accentColor}</dd>
            </div>
          </dl>
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logoUrl}
              alt={branding.displayName}
              className="size-16 rounded-md border object-contain"
            />
          ) : (
            <p className="text-sm text-muted-foreground">No logo uploaded.</p>
          )}
          <OrganizationBrandingForm
            organizationId={organization.id}
            branding={branding}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
          <CardDescription>
            Manual plan records only. Stripe and payment processing are not connected yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Plan</dt>
              <dd className="mt-1 font-medium capitalize">{subscription?.plan ?? "None"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Subscription status</dt>
              <dd className="mt-1 font-medium capitalize">
                {subscription?.status?.replaceAll("_", " ") ?? "None"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Billing interval</dt>
              <dd className="mt-1 font-medium capitalize">
                {subscription?.billing_interval ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Renewal date</dt>
              <dd className="mt-1 font-medium">
                {subscription?.renews_at
                  ? new Date(subscription.renews_at).toLocaleDateString()
                  : "—"}
              </dd>
            </div>
          </dl>
          <OrganizationSubscriptionForm
            organizationId={organization.id}
            subscription={subscription}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            Organization memberships only. Guest records are not listed. Platform-admin
            privileges cannot be granted here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <InviteUserForm organizationId={organization.id} />
          {organization.members.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No users are attached to this organization.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-muted-foreground">
                  <tr>
                    <th className="py-2 font-medium">Name</th>
                    <th className="py-2 font-medium">Email</th>
                    <th className="py-2 font-medium">Role</th>
                    <th className="py-2 font-medium">Membership</th>
                    <th className="py-2 font-medium">Created / invited</th>
                    <th className="py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {organization.members.map((member) => (
                    <tr key={member.id} className="border-b last:border-0">
                      <td className="py-3">
                        {member.fullName ?? "—"}
                        {member.role === "owner" ? (
                          <span className="ms-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                            Owner
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3">{member.email ?? "—"}</td>
                      <td className="py-3 capitalize">{member.role}</td>
                      <td className="py-3">
                        <StatusBadge status={member.status} />
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {new Date(member.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3">
                        <MemberActions
                          organizationId={organization.id}
                          userId={member.userId}
                          role={member.role}
                          status={member.status}
                          isLastOwner={
                            member.role === "owner" && actingOwners.length <= 1
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Owner</CardTitle>
          <CardDescription>
            An organization must keep at least one owner. Transfer is atomic and stays inside
            this organization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">
            {organization.owner
              ? `${organization.owner.fullName || organization.owner.email || "Owner"} · ${organization.owner.status}`
              : "No owner is currently assigned."}
          </p>
          <TransferOwnershipForm
            organizationId={organization.id}
            candidates={transferCandidates}
          />
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Admin audit activity</CardTitle>
            <CardDescription>
              Privileged Internal Admin actions for this organization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {organization.auditActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No administrative audit events yet.</p>
            ) : (
              <ul className="divide-y">
                {organization.auditActivity.map((entry) => (
                  <li key={entry.id} className="flex flex-col gap-1 py-3">
                    <p className="text-sm font-medium">{entry.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.actorType} · {entry.targetType} ·{" "}
                      {new Date(entry.createdAt).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Product events</CardTitle>
            <CardDescription>
              Operational events from the client workspace. These are not audit logs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {organization.productEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No product events yet.</p>
            ) : (
              <ul className="divide-y">
                {organization.productEvents.map((entry) => (
                  <li key={entry.id} className="flex flex-col gap-1 py-3">
                    <p className="text-sm font-medium">{entry.eventType}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Status management</CardTitle>
          <CardDescription>
            Suspended organizations keep their data. Client workspace authorization continues
            to reject suspended members.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrganizationStatusForm
            organizationId={organization.id}
            status={organization.status}
          />
        </CardContent>
      </Card>
    </div>
  );
}
