import Link from "next/link";

import { ActivityList } from "@/components/admin/activity-list";
import { MetricCard } from "@/components/admin/metric-card";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ADMIN_ROUTES } from "@/config/admin";
import { getAdminDashboardData } from "@/lib/admin/dashboard";

export const metadata = {
  title: "Dashboard",
};

export default async function AdminDashboardPage() {
  const { metrics, activity } = await getAdminDashboardData();
  const hasNoClients = metrics.organizations === 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Platform overview for Onwarda operators.
        </p>
      </div>

      <section aria-label="Platform metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total organizations"
          value={metrics.organizations}
          href={ADMIN_ROUTES.clients}
        />
        <MetricCard
          label="Active organizations"
          value={metrics.activeOrganizations}
          href={`${ADMIN_ROUTES.clients}?status=active`}
        />
        <MetricCard
          label="Suspended organizations"
          value={metrics.suspendedOrganizations}
          href={`${ADMIN_ROUTES.clients}?status=suspended`}
        />
        <MetricCard label="Organization users" value={metrics.organizationUsers} />
        <MetricCard label="Properties" value={metrics.properties} />
        <MetricCard label="Reservations" value={metrics.reservations} />
        <MetricCard label="Guests" value={metrics.guests} />
      </section>

      {hasNoClients ? (
        <Card>
          <CardHeader>
            <CardTitle>No clients yet</CardTitle>
            <CardDescription>
              Counts are live. Create a client to provision the first organization and invite its owner.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>
            Administrative audit events only. Tenant records are not listed here.
          </CardDescription>
          <CardAction>
            <Link
              href={ADMIN_ROUTES.activity}
              className="text-sm font-medium underline-offset-4 hover:underline"
            >
              View all
            </Link>
          </CardAction>
        </CardHeader>
        <CardContent>
          <ActivityList
            entries={activity}
            emptyDescription="No administrative activity has been recorded yet."
          />
        </CardContent>
      </Card>
    </div>
  );
}
