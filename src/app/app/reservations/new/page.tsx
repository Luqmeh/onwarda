import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ClientPageHeader, ClientSectionCard } from "@/components/workspace/client-ui";
import { CreateReservationForm } from "@/components/workspace/reservation-form";
import { CLIENT_ROUTES } from "@/config/client";
import { ORGANIZATION_OPERATIONAL_ROLES } from "@/lib/authorization/roles";
import { TenantIsolationError } from "@/lib/errors";
import { requireOrganizationRole } from "@/lib/tenancy/context";
import { uuidSchema } from "@/lib/validation/common";
import {
  listWorkspaceGuestsForSelect,
  listWorkspaceProperties,
} from "@/lib/workspace/data";

export const metadata = {
  title: "New reservation",
};

export default async function ClientAddReservationPage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string }>;
}) {
  try {
    await requireOrganizationRole(ORGANIZATION_OPERATIONAL_ROLES);
  } catch (error) {
    if (error instanceof TenantIsolationError) {
      return (
        <ClientSectionCard title="Not available">
          <p className="text-sm text-onwarda-muted">
            Creating a reservation requires an owner, admin, or manager role.
          </p>
        </ClientSectionCard>
      );
    }

    throw error;
  }

  const query = await searchParams;
  const requestedProperty = uuidSchema.safeParse(query.property);
  const [properties, guests] = await Promise.all([
    listWorkspaceProperties(),
    listWorkspaceGuestsForSelect(),
  ]);
  const defaultPropertyId = requestedProperty.success
    ? properties.find((property) => property.id === requestedProperty.data)?.id
    : undefined;

  return (
    <div className="space-y-6">
      <ClientPageHeader
        kicker="Stays"
        title="New reservation"
        description="Create a stay for a property in this organization. The guest must also belong here."
        actions={
          <Button asChild variant="outline">
            <Link href={CLIENT_ROUTES.reservations}>Back to reservations</Link>
          </Button>
        }
      />
      <ClientSectionCard title="Stay details">
        {properties.length === 0 ? (
          <p className="text-sm text-onwarda-muted">
            Add a property before creating a reservation.
          </p>
        ) : (
          <CreateReservationForm
            properties={properties}
            guests={guests}
            defaultPropertyId={defaultPropertyId}
          />
        )}
      </ClientSectionCard>
    </div>
  );
}
