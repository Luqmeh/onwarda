import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  ClientEmptyState,
  ClientPageHeader,
  ClientSectionCard,
  ClientStatusBadge,
} from "@/components/workspace/client-ui";
import { CLIENT_ROUTES, canManageWorkspace, clientPropertyPath } from "@/config/client";
import { requireWorkspaceView } from "@/lib/tenancy/workspace-access";
import { listWorkspaceProperties } from "@/lib/workspace/data";
import { propertyLocation, statusTone } from "@/lib/workspace/format";

export const metadata = {
  title: "Properties",
};

export default async function ClientPropertiesPage() {
  const [view, properties] = await Promise.all([
    requireWorkspaceView(),
    listWorkspaceProperties(),
  ]);
  const canAdd =
    view.kind === "membership" && canManageWorkspace(view.context.membership.role);

  return (
    <div className="space-y-6">
      <ClientPageHeader
        kicker="Homes"
        title="Properties"
        description="The places guests stay. Each property is its own house, riad, or room — never mixed across clients."
        actions={
          canAdd ? (
            <Button asChild>
              <Link href={CLIENT_ROUTES.propertyNew}>Add property</Link>
            </Button>
          ) : null
        }
      />

      <ClientSectionCard title="Directory">
        {properties.length === 0 ? (
          <ClientEmptyState
            title="Your properties will appear here."
            description="Add the first home to begin shaping guest journeys from arrival to farewell."
            action={
              canAdd ? (
                <Button asChild>
                  <Link href={CLIENT_ROUTES.propertyNew}>Add property</Link>
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-onwarda-muted">
                <tr>
                  <th className="py-2 font-medium">Property</th>
                  <th className="py-2 font-medium">Location</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium">Reservations</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((property) => (
                  <tr key={property.id} className="border-b last:border-0">
                    <td className="py-3 font-medium">
                      <Link
                        href={clientPropertyPath(property.id)}
                        className="hover:text-onwarda-olive hover:underline"
                      >
                        {property.name}
                      </Link>
                    </td>
                    <td className="py-3 text-onwarda-muted">
                      {propertyLocation(property) ?? "—"}
                    </td>
                    <td className="py-3">
                      <ClientStatusBadge label={property.status} tone={statusTone(property.status)} />
                    </td>
                    <td className="py-3">{property.reservationCount}</td>
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
