import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  ClientEmptyState,
  ClientPageHeader,
  ClientSectionCard,
  ClientStatusBadge,
} from "@/components/workspace/client-ui";
import { CLIENT_ROUTES, canManageWorkspace, clientPropertyPath } from "@/config/client";
import { getRequestI18n } from "@/i18n/get-locale";
import { clientMetadata } from "@/i18n/page-title";
import { fillMessage } from "@/i18n/locale";
import { requireWorkspaceView } from "@/lib/tenancy/workspace-access";
import { listWorkspaceProperties } from "@/lib/workspace/data";
import { propertyLocation, statusTone } from "@/lib/workspace/format";

export async function generateMetadata() {
  return clientMetadata((messages) => ({ title: messages.titles.properties }));
}

export default async function ClientPropertiesPage() {
  const [{ messages }, view, properties] = await Promise.all([
    getRequestI18n(),
    requireWorkspaceView(),
    listWorkspaceProperties(),
  ]);
  const canAdd =
    view.kind === "membership" && canManageWorkspace(view.context.membership.role);

  return (
    <div className="space-y-6">
      <ClientPageHeader
        kicker={messages.copy.homesKicker}
        title={messages.copy.properties}
        description={messages.copy.propertiesDescription}
        actions={
          canAdd ? (
            <Button asChild>
              <Link href={CLIENT_ROUTES.propertyNew}>{messages.copy.addProperty}</Link>
            </Button>
          ) : null
        }
      />

      {properties.length === 0 ? (
        <ClientSectionCard title={messages.copy.portfolio}>
          <ClientEmptyState
            title={messages.copy.portfolioEmptyTitle}
            description={messages.copy.portfolioEmptyBody}
            action={
              canAdd ? (
                <Button asChild>
                  <Link href={CLIENT_ROUTES.propertyNew}>{messages.copy.addProperty}</Link>
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
                    <p className="text-sm text-onwarda-muted">{propertyLocation(property) ?? messages.copy.locationNotSet}</p>
                  </div>
                  <p className="text-sm text-onwarda-muted">
                    {property.propertyType
                      ? messages.catalog[property.propertyType as keyof typeof messages.catalog]
                      : messages.copy.property}
                    {" · "}
                    {fillMessage(messages.copy.staysCount, { count: property.reservationCount })}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <ClientStatusBadge
                      label={
                        property.status === "draft"
                          ? messages.screens.draft
                          : property.status === "active"
                            ? messages.screens.active
                            : property.status === "inactive"
                              ? messages.screens.inactive
                              : property.status === "archived"
                                ? messages.screens.archived
                                : property.status
                      }
                      tone={statusTone(property.status)}
                    />
                    <ClientStatusBadge
                      label={
                        messages.catalog[(property.readiness ?? "ready") as keyof typeof messages.catalog] ??
                        messages.catalog.ready
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
