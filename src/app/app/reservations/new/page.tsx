import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ClientPageHeader, ClientSectionCard } from "@/components/workspace/client-ui";
import { CreateReservationForm } from "@/components/workspace/reservation-form";
import { CLIENT_ROUTES } from "@/config/client";
import { ORGANIZATION_OPERATIONAL_ROLES } from "@/lib/authorization/roles";
import { TenantIsolationError } from "@/lib/errors";
import { getRequestI18n } from "@/i18n/get-locale";
import { clientMetadata } from "@/i18n/page-title";
import { requireOrganizationRole } from "@/lib/tenancy/context";
import { uuidSchema } from "@/lib/validation/common";
import {
  listWorkspaceGuestsForSelect,
  listWorkspaceProperties,
} from "@/lib/workspace/data";

export async function generateMetadata() {
  return clientMetadata((messages) => ({ title: messages.titles.newReservation }));
}

export default async function ClientAddReservationPage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string }>;
}) {
  const { messages } = await getRequestI18n();
  try {
    await requireOrganizationRole(ORGANIZATION_OPERATIONAL_ROLES);
  } catch (error) {
    if (error instanceof TenantIsolationError) {
      return (
        <ClientSectionCard title={messages.fields.notAvailable}>
          <p className="text-sm text-onwarda-muted">
            {messages.screens.roleRequiredReservation}
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
        title={messages.copy.newReservation}
        description={messages.screens.newReservationHelp}
        actions={
          <Button asChild variant="outline">
            <Link href={CLIENT_ROUTES.reservations}>Back to reservations</Link>
          </Button>
        }
      />
      <ClientSectionCard title={messages.screens.stayDetails}>
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
