import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  ClientEmptyState,
  ClientMetricCard,
  ClientPageHeader,
  ClientSectionCard,
  ClientStatusBadge,
} from "@/components/workspace/client-ui";
import { PropertyAmenitiesForm } from "@/components/workspace/property-cms/amenities-form";
import { PropertyBasicsForm } from "@/components/workspace/property-cms/basics-form";
import { PropertyContentForm } from "@/components/workspace/property-cms/content-form";
import { PropertyKnowledgeCms } from "@/components/workspace/property-cms/knowledge-cms";
import { PropertyMediaCms } from "@/components/workspace/property-cms/media-cms";
import { PropertyHouseRulesForm } from "@/components/workspace/property-cms/rules-form";
import {
  CmsSection,
  VisibilityBadge,
} from "@/components/workspace/property-cms/section";
import { publicPropertyPath } from "@/config/app";
import {
  CLIENT_ROUTES,
  canManagePropertyCms,
  canManageStays,
  clientReservationCreatePath,
  clientReservationPath,
} from "@/config/client";
import { NotFoundError } from "@/lib/errors";
import {
  contentFieldsForGroup,
} from "@/lib/property-cms/catalog";
import { getRequestI18n } from "@/i18n/get-locale";
import { clientMetadata } from "@/i18n/page-title";
import { formattingLocale } from "@/i18n/locale";
import { requireWorkspaceView } from "@/lib/tenancy/workspace-access";
import { getWorkspaceProperty } from "@/lib/workspace/data";
import {
  formatDate,
  guestDisplayName,
  humanizeToken,
  propertyLocation,
  reservationStatusLabel,
  statusTone,
} from "@/lib/workspace/format";

export async function generateMetadata() {
  return clientMetadata((messages) => ({ title: messages.titles.property }));
}

function contentMap(content: Array<{ fieldKey: string; body: string; visibility: string }>) {
  return new Map(content.map((field) => [field.fieldKey, field]));
}

function contentFieldLabel(
  field: string,
  catalog: {
    neighborhood: string;
    nearbyAttractions: string;
    transportation: string;
    localInformation: string;
    arrivalInstructions: string;
    parkingInstructions: string;
    buildingEntry: string;
    keyRetrieval: string;
    lockbox: string;
    smartLock: string;
    reception: string;
    contactInformation: string;
    internalNotes: string;
  },
) {
  const labels: Record<string, string> = {
    neighborhood: catalog.neighborhood,
    nearby_attractions: catalog.nearbyAttractions,
    transportation: catalog.transportation,
    local_information: catalog.localInformation,
    arrival_instructions: catalog.arrivalInstructions,
    parking_instructions: catalog.parkingInstructions,
    building_entry: catalog.buildingEntry,
    key_retrieval: catalog.keyRetrieval,
    lockbox_instructions: catalog.lockbox,
    smart_lock_instructions: catalog.smartLock,
    reception_instructions: catalog.reception,
    contact_information: catalog.contactInformation,
    private_notes: catalog.internalNotes,
  };
  return labels[field] ?? field;
}

export default async function ClientPropertyDetailPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  const [{ locale, messages }, view] = await Promise.all([
    getRequestI18n(),
    requireWorkspaceView(),
  ]);
  const dates = formattingLocale(locale);

  let property;

  try {
    property = await getWorkspaceProperty(propertyId);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }

    throw error;
  }

  const canEdit =
    view.kind === "membership" && canManagePropertyCms(view.context.membership.role);
  const canCreateStay =
    view.kind === "membership" && canManageStays(view.context.membership.role);
  const location = propertyLocation(property);
  const hero = property.media.find((item) => item.role === "hero" && item.signedUrl);
  const fields = contentMap(property.content);
  const typeLabel = property.propertyType
    ? messages.catalog[property.propertyType as keyof typeof messages.catalog]
    : messages.screens.typeNotSet;

  return (
    <div className="space-y-6">
      {hero ? (
        <div className="overflow-hidden rounded-[var(--onwarda-radius)] border shadow-onwarda">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={hero.signedUrl ?? ""}
            alt={hero.altText || hero.caption || property.name}
            className="h-56 w-full object-cover sm:h-72"
          />
        </div>
      ) : null}

      <ClientPageHeader
        kicker={messages.screens.propertyCms}
        title={property.name}
        description={
          [typeLabel, location, property.internalIdentifier ? `Internal: ${property.internalIdentifier}` : null]
            .filter(Boolean)
            .join(" · ") || messages.screens.completeHome
        }
        actions={
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
            {canCreateStay ? (
              <Button asChild>
                <Link href={clientReservationCreatePath(property.id)}>Create reservation</Link>
              </Button>
            ) : null}
            {property.isListedPublicly && property.status === "active" ? (
              <Button asChild variant="outline">
                <Link href={publicPropertyPath(view.context.organization.slug, property.slug)}>
                  Public page
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link href={CLIENT_ROUTES.properties}>All properties</Link>
            </Button>
          </div>
        }
      />

      <section aria-label={messages.screens.propertySummary} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ClientMetricCard
          label={messages.nav.reservations}
          value={property.reservationCount}
          href={CLIENT_ROUTES.reservations}
        />
        <ClientMetricCard label={messages.screens.guestsWhoStayed} value={property.stayGuestCount} />
        <ClientMetricCard
          label={messages.copy.openIssues}
          value={property.openIssueCount}
          href={CLIENT_ROUTES.issues}
        />
        <ClientMetricCard label={messages.screens.instructions} value={property.knowledgeCount} />
      </section>

      <CmsSection
        title={messages.screens.basicInformation}
        description={messages.screens.basicInformationHelp}
        canEdit={canEdit}
        summary={
          <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-onwarda-muted">Name</dt>
              <dd className="mt-1 font-medium">{property.name}</dd>
            </div>
            <div>
              <dt className="text-onwarda-muted">Internal identifier</dt>
              <dd className="mt-1 font-medium">{property.internalIdentifier ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-onwarda-muted">Type</dt>
              <dd className="mt-1 font-medium">{typeLabel}</dd>
            </div>
            <div>
              <dt className="text-onwarda-muted">Address</dt>
              <dd className="mt-1 font-medium">{property.address ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-onwarda-muted">Location</dt>
              <dd className="mt-1 font-medium">{location ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-onwarda-muted">Capacity</dt>
              <dd className="mt-1 font-medium">{property.capacity ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-onwarda-muted">Bedrooms / bathrooms</dt>
              <dd className="mt-1 font-medium">
                {property.bedrooms ?? "—"} / {property.bathrooms ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-onwarda-muted">{messages.fields.checkIn} / {messages.fields.checkOut}</dt>
              <dd className="mt-1 font-medium">
                {property.checkInTime ?? "—"} / {property.checkOutTime ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-onwarda-muted">{messages.fields.supportedLanguages}</dt>
              <dd className="mt-1 font-medium">
                {property.languages.length > 0
                  ? property.languages
                      .map((code) =>
                        code === "en"
                          ? messages.languages.en
                          : code === "fr"
                            ? messages.languages.fr
                            : code === "ar"
                              ? messages.languages.ar
                              : code === "es"
                                ? messages.catalog.spanish
                                : code === "de"
                                  ? messages.catalog.german
                                  : code === "it"
                                    ? messages.catalog.italian
                                    : code,
                      )
                      .join(", ")
                  : "—"}
              </dd>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <dt className="text-onwarda-muted">Short description</dt>
              <dd className="mt-1 leading-relaxed">{property.description ?? "—"}</dd>
            </div>
          </dl>
        }
      >
        <PropertyBasicsForm
          propertyId={property.id}
          name={property.name}
          internalIdentifier={property.internalIdentifier}
          propertyType={property.propertyType}
          address={property.address}
          city={property.city}
          country={property.country}
          capacity={property.capacity}
          bedrooms={property.bedrooms}
          bathrooms={property.bathrooms}
          checkInTime={property.checkInTime}
          checkOutTime={property.checkOutTime}
          description={property.description}
          languages={property.languages}
          status={property.status}
          isListedPublicly={property.isListedPublicly}
          bookingUrl={property.bookingUrl}
        />
      </CmsSection>

      <CmsSection
        title={messages.screens.amenities}
        description={messages.screens.amenitiesHelp}
        canEdit={canEdit}
        summary={
          property.amenities.length === 0 ? (
            <p className="text-sm text-onwarda-muted">{messages.screens.noAmenitiesYet}</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {property.amenities.map((amenity) => (
                <li key={amenity}>
                  <ClientStatusBadge
                    label={
                      amenity === "workspace"
                        ? messages.catalog.amenityWorkspace
                        : messages.catalog[amenity as keyof typeof messages.catalog] ?? amenity
                    }
                    tone="sage"
                  />
                </li>
              ))}
            </ul>
          )
        }
      >
        <PropertyAmenitiesForm propertyId={property.id} selected={property.amenities} />
      </CmsSection>

      <CmsSection
        title={messages.screens.houseRules}
        description={messages.screens.houseRulesHelp}
        canEdit={canEdit}
        summary={
          property.houseRules.length === 0 ? (
            <p className="text-sm text-onwarda-muted">{messages.screens.noHouseRulesYet}</p>
          ) : (
            <ul className="divide-y">
              {property.houseRules.map((rule) => (
                <li key={rule.ruleKey} className="flex flex-col gap-1 py-3 sm:flex-row sm:justify-between">
                  <div>
                    <p className="font-medium">
                      {rule.ruleKey === "checkout"
                        ? messages.catalog.checkout_rules
                        : messages.catalog[rule.ruleKey as keyof typeof messages.catalog] ?? rule.ruleKey}
                    </p>
                    <p className="text-sm text-onwarda-muted">
                      {messages.catalog[rule.state as keyof typeof messages.catalog] ?? rule.state}
                      {rule.details ? ` · ${rule.details}` : ""}
                    </p>
                  </div>
                  <VisibilityBadge visibility={rule.visibility} />
                </li>
              ))}
            </ul>
          )
        }
      >
        <PropertyHouseRulesForm propertyId={property.id} rules={property.houseRules} />
      </CmsSection>

      <CmsSection
        title={messages.screens.arrivalAccess}
        description={messages.screens.arrivalAccessHelp}
        canEdit={canEdit}
        summary={
          <dl className="space-y-4 text-sm">
            {contentFieldsForGroup("access").map((field) => {
              const current = fields.get(field);
              return (
                <div key={field}>
                  <dt className="flex items-center gap-2 text-onwarda-muted">
                    {contentFieldLabel(field, messages.catalog)}
                    {current ? <VisibilityBadge visibility={current.visibility as "public" | "guest" | "private"} /> : null}
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap leading-relaxed">
                    {current?.body ?? "—"}
                  </dd>
                </div>
              );
            })}
          </dl>
        }
      >
        <PropertyContentForm propertyId={property.id} group="access" values={property.content} />
      </CmsSection>

      <CmsSection
        title={messages.screens.propertyContent}
        description={messages.screens.propertyContentHelp}
        canEdit={canEdit}
        summary={
          <dl className="space-y-4 text-sm">
            {contentFieldsForGroup("content").map((field) => {
              const current = fields.get(field);
              return (
                <div key={field}>
                  <dt className="flex items-center gap-2 text-onwarda-muted">
                    {contentFieldLabel(field, messages.catalog)}
                    {current ? <VisibilityBadge visibility={current.visibility as "public" | "guest" | "private"} /> : null}
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap leading-relaxed">
                    {current?.body ?? "—"}
                  </dd>
                </div>
              );
            })}
          </dl>
        }
      >
        <PropertyContentForm propertyId={property.id} group="content" values={property.content} />
      </CmsSection>

      <CmsSection
        title={messages.screens.internalNotes}
        description={messages.screens.internalNotesHelp}
        canEdit={canEdit}
        summary={
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {fields.get("private_notes")?.body ?? messages.screens.noInternalNotes}
          </p>
        }
      >
        <PropertyContentForm propertyId={property.id} group="private" values={property.content} />
      </CmsSection>

      <ClientSectionCard
        title={messages.screens.instructions}
        description={messages.screens.instructionsHelp}
      >
        <PropertyKnowledgeCms
          propertyId={property.id}
          entries={property.knowledge}
          canEdit={canEdit}
        />
      </ClientSectionCard>

      <ClientSectionCard
        title="Media"
        description={messages.screens.mediaHelp}
      >
        <PropertyMediaCms propertyId={property.id} media={property.media} canEdit={canEdit} />
      </ClientSectionCard>

      <ClientSectionCard
        title={messages.nav.reservations}
        description={messages.screens.propertyReservationsHelp}
        action={
          <Link href={CLIENT_ROUTES.reservations} className="text-sm text-onwarda-olive hover:underline">
            View reservations
          </Link>
        }
      >
        {property.reservations.length === 0 ? (
          <ClientEmptyState
            title={messages.screens.noReservationsYet}
            description={messages.screens.propertyReservationsEmpty}
            action={
              canCreateStay ? (
                <Button asChild>
                  <Link href={clientReservationCreatePath(property.id)}>Create reservation</Link>
                </Button>
              ) : null
            }
          />
        ) : (
          <ul className="divide-y">
            {property.reservations.map((reservation) => (
              <li key={reservation.id}>
                <Link
                  href={clientReservationPath(reservation.id)}
                  className="flex flex-col gap-1 py-3 hover:text-onwarda-olive sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{guestDisplayName(reservation.guestName)}</p>
                    <p className="text-sm text-onwarda-muted">
                      {formatDate(reservation.checkIn, dates)} – {formatDate(reservation.checkOut, dates)}
                    </p>
                  </div>
                  <ClientStatusBadge
                    label={reservationStatusLabel(reservation.status)}
                    tone={statusTone(reservation.status)}
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </ClientSectionCard>

      <ClientSectionCard
        title="Issues"
        description={messages.screens.propertyIssuesHelp}
        action={
          <Link href={CLIENT_ROUTES.issues} className="text-sm text-onwarda-olive hover:underline">
            View issues
          </Link>
        }
      >
        {property.issues.length === 0 ? (
          <p className="text-sm text-onwarda-muted">No open issues for this property.</p>
        ) : (
          <ul className="divide-y">
            {property.issues.map((issue) => (
              <li key={issue.id} className="py-3">
                <p className="font-medium capitalize">{humanizeToken(issue.category)}</p>
                <p className="line-clamp-2 text-sm text-onwarda-muted">{issue.description}</p>
              </li>
            ))}
          </ul>
        )}
      </ClientSectionCard>
    </div>
  );
}
