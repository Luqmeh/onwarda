import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ADMIN_ROUTES, adminClientPath } from "@/config/admin";
import { retryOrganizationDeletionAction } from "@/lib/admin/offboarding-actions";
import { listIncompleteDeletionJobs } from "@/lib/admin/offboarding";
import { listAdminOrganizations } from "@/lib/admin/organizations";
import { ORGANIZATION_STATUSES } from "@/types/enums";

export const metadata = {
  title: "Clients",
};

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string; notice?: string; detail?: string }>;
}) {
  const params = await searchParams;
  const incompleteJobs = await listIncompleteDeletionJobs();
  const page = Number.parseInt(params.page ?? "1", 10);
  const result = await listAdminOrganizations({
    query: params.q,
    status: params.status,
    page: Number.isFinite(page) ? page : 1,
  });
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const hasFilters = Boolean(result.query || result.status);
  const isEmpty = result.organizations.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground">
            Customer organizations. The organization UUID remains the canonical tenant identity.
          </p>
        </div>
        <Button asChild>
          <Link href={ADMIN_ROUTES.clientNew}>Create client</Link>
        </Button>
      </div>

      {params.notice === "client-deleted" ? (
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm" role="status">
          The client and its tenant data were permanently deleted.
        </p>
      ) : null}
      {params.notice === "cleanup-incomplete" ? (
        <p className="rounded-lg border border-destructive/40 px-3 py-2 text-sm" role="alert">
          Deletion cleanup is still incomplete.
          {params.detail ? ` ${params.detail}` : ""}
        </p>
      ) : null}
      {incompleteJobs.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Unfinished deletions</CardTitle>
            <CardDescription>
              These cleanups are still incomplete. They do not name the former client.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {incompleteJobs.map((job) => (
              <form key={job.id} action={retryOrganizationDeletionAction} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <p>
                  Started {new Date(job.created_at).toLocaleString()}. Storage{" "}
                  {job.storage_removed ? "removed" : "pending"}. Database{" "}
                  {job.database_removed ? "removed" : "pending"}. Accounts{" "}
                  {job.auth_removed ? "removed" : "pending"}.
                </p>
                <input type="hidden" name="jobId" value={job.id} />
                <Button type="submit" variant="outline">
                  Retry unfinished cleanup
                </Button>
              </form>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Organizations</CardTitle>
          <CardDescription>
            {result.total === 0
              ? hasFilters
                ? "No organizations match these filters."
                : "No client organizations exist yet."
              : `${result.total} organization${result.total === 1 ? "" : "s"}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form method="get" className="grid gap-3 sm:grid-cols-[1fr_12rem_auto]">
            <Input
              name="q"
              type="search"
              defaultValue={result.query}
              placeholder="Search name or slug"
              aria-label="Search organizations"
            />
            <select
              name="status"
              defaultValue={result.status}
              aria-label="Filter by status"
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="">All statuses</option>
              {Object.values(ORGANIZATION_STATUSES).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline">
              Filter
            </Button>
          </form>

          {isEmpty ? (
            <p className="text-sm text-muted-foreground">
              {hasFilters
                ? "Try a different search or status."
                : "Create a client to provision the first organization and invite its owner."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-muted-foreground">
                  <tr>
                    <th className="py-2 font-medium">Organization</th>
                    <th className="py-2 font-medium">Slug</th>
                    <th className="py-2 font-medium">Status</th>
                    <th className="py-2 font-medium">Users</th>
                    <th className="py-2 font-medium">Properties</th>
                    <th className="py-2 font-medium">Reservations</th>
                    <th className="py-2 font-medium">Guests</th>
                    <th className="py-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {result.organizations.map((client) => (
                    <tr key={client.id} className="border-b last:border-0">
                      <td className="py-3 font-medium">
                        <Link
                          href={adminClientPath(client.id)}
                          className="underline-offset-4 hover:underline"
                        >
                          {client.name}
                        </Link>
                      </td>
                      <td className="py-3 text-muted-foreground">{client.slug}</td>
                      <td className="py-3 capitalize">{client.status}</td>
                      <td className="py-3">{client.userCount}</td>
                      <td className="py-3">{client.propertyCount}</td>
                      <td className="py-3">{client.reservationCount}</td>
                      <td className="py-3">{client.guestCount}</td>
                      <td className="py-3 text-muted-foreground">
                        {new Date(client.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 ? (
            <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
              <p className="text-muted-foreground">
                Page {result.page} of {totalPages}
              </p>
              <div className="flex gap-2">
                {result.page > 1 ? (
                  <Link
                    href={clientsHref({ ...result, page: result.page - 1 })}
                    className="underline-offset-4 hover:underline"
                  >
                    Previous
                  </Link>
                ) : null}
                {result.page < totalPages ? (
                  <Link
                    href={clientsHref({ ...result, page: result.page + 1 })}
                    className="underline-offset-4 hover:underline"
                  >
                    Next
                  </Link>
                ) : null}
              </div>
            </nav>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function clientsHref(options: { query: string; status: string; page: number }) {
  const params = new URLSearchParams();
  if (options.query) {
    params.set("q", options.query);
  }
  if (options.status) {
    params.set("status", options.status);
  }
  if (options.page > 1) {
    params.set("page", String(options.page));
  }
  const query = params.toString();
  return query ? `${ADMIN_ROUTES.clients}?${query}` : ADMIN_ROUTES.clients;
}
