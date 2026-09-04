import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ClientPageHeader, ClientSectionCard } from "@/components/workspace/client-ui";
import { CreatePropertyForm } from "@/components/workspace/property-form";
import { CLIENT_ROUTES } from "@/config/client";
import { ORGANIZATION_ADMIN_ROLES } from "@/lib/authorization/roles";
import { TenantIsolationError } from "@/lib/errors";
import { requireOrganizationRole } from "@/lib/tenancy/context";

export const metadata = {
  title: "Add property",
};

export default async function ClientAddPropertyPage() {
  try {
    await requireOrganizationRole(ORGANIZATION_ADMIN_ROLES);
  } catch (error) {
    if (error instanceof TenantIsolationError) {
      return (
        <ClientSectionCard title="Not available">
          <p className="text-sm text-onwarda-muted">
            Adding a property requires an owner or admin role.
          </p>
        </ClientSectionCard>
      );
    }

    throw error;
  }

  return (
    <div className="space-y-6">
      <ClientPageHeader
        kicker="Homes"
        title="Add property"
        description="Create a home for this organization. The organization is taken from your membership, never from the browser."
        actions={
          <Button asChild variant="outline">
            <Link href={CLIENT_ROUTES.properties}>Back to properties</Link>
          </Button>
        }
      />
      <ClientSectionCard title="Property details">
        <CreatePropertyForm />
      </ClientSectionCard>
    </div>
  );
}
