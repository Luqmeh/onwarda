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
import { getMessages } from "@/i18n/get-messages";

export const metadata = {
  title: "Dashboard",
};

export default async function AdminDashboardPage() {
  const messages = getMessages("en");
  const { metrics, activity } = await getAdminDashboardData();
  const hasNoClients = metrics.organizations === 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{messages.nav.dashboard}</h1>
        <p className="text-sm text-muted-foreground">{messages.copy.adminDashboardBody}</p>
      </div>

      <section aria-label={messages.copy.platformMetrics} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={messages.copy.totalOrganizations}
          value={metrics.organizations}
          href={ADMIN_ROUTES.clients}
        />
        <MetricCard
          label={messages.copy.activeOrganizations}
          value={metrics.activeOrganizations}
          href={`${ADMIN_ROUTES.clients}?status=active`}
        />
        <MetricCard
          label={messages.copy.suspendedOrganizations}
          value={metrics.suspendedOrganizations}
          href={`${ADMIN_ROUTES.clients}?status=suspended`}
        />
        <MetricCard label={messages.copy.organizationUsers} value={metrics.organizationUsers} />
        <MetricCard label={messages.copy.properties} value={metrics.properties} />
        <MetricCard label={messages.nav.reservations} value={metrics.reservations} />
        <MetricCard label={messages.copy.guests} value={metrics.guests} />
      </section>

      {hasNoClients ? (
        <Card>
          <CardHeader>
            <CardTitle>{messages.copy.noClientsYet}</CardTitle>
            <CardDescription>{messages.copy.noClientsBody}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{messages.copy.recentActivity}</CardTitle>
          <CardDescription>{messages.copy.adminActivityBody}</CardDescription>
          <CardAction>
            <Link
              href={ADMIN_ROUTES.activity}
              className="text-sm font-medium underline-offset-4 hover:underline"
            >
              {messages.copy.viewAll}
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
