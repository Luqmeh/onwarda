import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ClientPageHeader, ClientSectionCard } from "@/components/workspace/client-ui";
import { CreatePropertyForm } from "@/components/workspace/property-form";
import { CLIENT_ROUTES } from "@/config/client";
import { ORGANIZATION_ADMIN_ROLES } from "@/lib/authorization/roles";
import { TenantIsolationError } from "@/lib/errors";
import { getRequestI18n } from "@/i18n/get-locale";
import { clientMetadata } from "@/i18n/page-title";
import { requireOrganizationRole } from "@/lib/tenancy/context";

export async function generateMetadata() {
  return clientMetadata((messages) => ({ title: messages.titles.addProperty }));
}

export default async function ClientAddPropertyPage() {
  const { messages } = await getRequestI18n();
  try {
    await requireOrganizationRole(ORGANIZATION_ADMIN_ROLES);
  } catch (error) {
    if (error instanceof TenantIsolationError) {
      return (
        <ClientSectionCard title={messages.fields.notAvailable}>
          <p className="text-sm text-onwarda-muted">
            {messages.screens.roleRequiredProperty}
          </p>
        </ClientSectionCard>
      );
    }

    throw error;
  }

  return (
    <div className="space-y-6">
      <ClientPageHeader
        kicker={messages.copy.homesKicker}
        title={messages.copy.addProperty}
        description={messages.screens.addPropertyHelp}
        actions={
          <Button asChild variant="outline">
            <Link href={CLIENT_ROUTES.properties}>Back to properties</Link>
          </Button>
        }
      />
      <ClientSectionCard title={messages.screens.propertyDetails}>
        <CreatePropertyForm />
      </ClientSectionCard>
    </div>
  );
}
