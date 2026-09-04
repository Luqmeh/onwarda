import { ActivityList } from "@/components/admin/activity-list";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminActivityFeed } from "@/lib/admin/dashboard";

export const metadata = {
  title: "Activity",
};

export default async function AdminActivityPage() {
  const entries = await getAdminActivityFeed();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
        <p className="text-sm text-muted-foreground">
          Security and administrative audit events. Product events and tenant records are not shown.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Audit log</CardTitle>
          <CardDescription>
            {entries.length === 0
              ? "No audit records yet."
              : "Most recent platform-admin actions."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActivityList
            entries={entries}
            emptyDescription="There is no administrative activity to display."
          />
        </CardContent>
      </Card>
    </div>
  );
}
