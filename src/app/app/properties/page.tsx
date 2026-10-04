import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  ClientEmptyState,
  ClientPageHeader,
  ClientSectionCard,
  ClientStatusBadge,
} from "@/components/workspace/client-ui";
import { CLIENT_ROUTES, canManageWorkspace, clientPropertyPath } from "@/config/client";
import { PROPERTY_READINESS_LABELS, type PropertyReadiness } from "@/lib/cleaning/catalog";
import { PROPERTY_TYPE_LABELS } from "@/lib/property-cms/catalog";
import { requireWorkspaceView } from "@/lib/tenancy/workspace-access";
import { listWorkspaceProperties } from "@/lib/workspace/data";
import { propertyLocation, statusTone } from "@/lib/workspace/format";
import type { PropertyType } from "@/types/enums";

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

      {properties.length === 0 ? (
        <ClientSectionCard title="Portfolio">
          <ClientEmptyState
            title="Your property portfolio starts here."
            description="Add the first home and build the stay your guests will actually use."
            action={
              canAdd ? (
                <Button asChild>
                  <Link href={CLIENT_ROUTES.propertyNew}>Add property</Link>
                </Button>
              ) : null
            }
          />
        </ClientSectionCard>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {properties.map((property) => (
            <li key={property.id}>
              <Link href={clientPropertyPath(property.id)} className="client-surface client-lift block overflow-hidden">
                <div className="flex h-28 items-end bg-[color-mix(in_srgb,var(--client-primary)_16%,var(--client-background))] p-4">
                  <span className="text-2xl font-medium tracking-tight text-onwarda-charcoal/80">
                    {property.name.slice(0, 1)}
                  </span>
                </div>
                <div className="space-y-3 p-4">
                  <div>
                    <p className="font-medium">{property.name}</p>
                    <p className="text-sm text-onwarda-muted">{propertyLocation(property) ?? "Location not set"}</p>
                  </div>
                  <p className="text-sm text-onwarda-muted">
                    {property.propertyType
                      ? PROPERTY_TYPE_LABELS[property.propertyType as PropertyType]
                      : "Home"}{" "}
                    · {property.reservationCount} stays
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <ClientStatusBadge label={property.status} tone={statusTone(property.status)} />
                    <ClientStatusBadge
                      label={
                        PROPERTY_READINESS_LABELS[(property.readiness ?? "ready") as PropertyReadiness] ??
                        "Ready"
                      }
                      tone={property.readiness === "ready" ? "olive" : "coral"}
                    />
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
