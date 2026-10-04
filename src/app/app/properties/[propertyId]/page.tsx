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
  HOUSE_RULE_LABELS,
  HOUSE_RULE_STATE_LABELS,
  PROPERTY_AMENITY_LABELS,
  PROPERTY_CONTENT_FIELD_META,
  PROPERTY_CONTENT_LANGUAGE_LABELS,
  PROPERTY_TYPE_LABELS,
  contentFieldsForGroup,
  type HouseRuleKey,
  type PropertyAmenity,
  type PropertyContentLanguage,
  type PropertyType,
} from "@/lib/property-cms/catalog";
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

export const metadata = {
  title: "Property CMS",
};

function contentMap(content: Array<{ fieldKey: string; body: string; visibility: string }>) {
  return new Map(content.map((field) => [field.fieldKey, field]));
}

export default async function ClientPropertyDetailPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  const view = await requireWorkspaceView();

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
    ? PROPERTY_TYPE_LABELS[property.propertyType as PropertyType]
    : "Type not set";

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
        kicker="Property CMS"
        title={property.name}
        description={
          [typeLabel, location, property.internalIdentifier ? `Internal: ${property.internalIdentifier}` : null]
            .filter(Boolean)
            .join(" · ") || "Complete this home once. Later surfaces will reuse it."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <ClientStatusBadge label={property.status} tone={statusTone(property.status)} />
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

      <section aria-label="Property summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ClientMetricCard
          label="Reservations"
          value={property.reservationCount}
          href={CLIENT_ROUTES.reservations}
        />
        <ClientMetricCard label="Guests who stayed" value={property.stayGuestCount} />
        <ClientMetricCard
          label="Open issues"
          value={property.openIssueCount}
          href={CLIENT_ROUTES.issues}
        />
        <ClientMetricCard label="Instructions" value={property.knowledgeCount} />
      </section>

      <CmsSection
        title="Basic information"
        description="Identity, location, capacity, and the languages this home can host."
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
              <dt className="text-onwarda-muted">Check-in / checkout</dt>
              <dd className="mt-1 font-medium">
                {property.checkInTime ?? "—"} / {property.checkOutTime ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-onwarda-muted">Languages</dt>
              <dd className="mt-1 font-medium">
                {property.languages.length > 0
                  ? property.languages
                      .map(
                        (code) =>
                          PROPERTY_CONTENT_LANGUAGE_LABELS[code as PropertyContentLanguage] ?? code,
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
        title="Amenities"
        description="Structured facilities later public pages, guest notes, and search can reuse."
        canEdit={canEdit}
        summary={
          property.amenities.length === 0 ? (
            <p className="text-sm text-onwarda-muted">No amenities selected yet.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {property.amenities.map((amenity) => (
                <li key={amenity}>
                  <ClientStatusBadge
                    label={PROPERTY_AMENITY_LABELS[amenity as PropertyAmenity] ?? amenity}
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
        title="House rules"
        description="Canonical rules. Guest Portal should consume these later instead of inventing its own."
        canEdit={canEdit}
        summary={
          property.houseRules.length === 0 ? (
            <p className="text-sm text-onwarda-muted">No house rules saved yet.</p>
          ) : (
            <ul className="divide-y">
              {property.houseRules.map((rule) => (
                <li key={rule.ruleKey} className="flex flex-col gap-1 py-3 sm:flex-row sm:justify-between">
                  <div>
                    <p className="font-medium">
                      {HOUSE_RULE_LABELS[rule.ruleKey as HouseRuleKey] ?? rule.ruleKey}
                    </p>
                    <p className="text-sm text-onwarda-muted">
                      {HOUSE_RULE_STATE_LABELS[rule.state as keyof typeof HOUSE_RULE_STATE_LABELS] ??
                        rule.state}
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
        title="Arrival and access"
        description="Sensitive access details stay guest-only or private. Public-safe loaders must never return lock codes."
        canEdit={canEdit}
        summary={
          <dl className="space-y-4 text-sm">
            {contentFieldsForGroup("access").map((field) => {
              const current = fields.get(field);
              const meta = PROPERTY_CONTENT_FIELD_META[field];
              return (
                <div key={field}>
                  <dt className="flex items-center gap-2 text-onwarda-muted">
                    {meta.label}
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
        title="Property content"
        description="Neighborhood, attractions, transport, and local context for later public pages."
        canEdit={canEdit}
        summary={
          <dl className="space-y-4 text-sm">
            {contentFieldsForGroup("content").map((field) => {
              const current = fields.get(field);
              const meta = PROPERTY_CONTENT_FIELD_META[field];
              return (
                <div key={field}>
                  <dt className="flex items-center gap-2 text-onwarda-muted">
                    {meta.label}
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
        title="Internal notes"
        description="Operator-private only. This field cannot be made public or guest-visible."
        canEdit={canEdit}
        summary={
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {fields.get("private_notes")?.body ?? "No internal notes."}
          </p>
        }
      >
        <PropertyContentForm propertyId={property.id} group="private" values={property.content} />
      </CmsSection>

      <ClientSectionCard
        title="Instructions / knowledge"
        description="The existing property knowledge system. Guest-visible published entries can feed the Guest Portal later."
      >
        <PropertyKnowledgeCms
          propertyId={property.id}
          entries={property.knowledge}
          canEdit={canEdit}
        />
      </ClientSectionCard>

      <ClientSectionCard
        title="Media"
        description="Hero image, gallery, and external video or 360° URLs. Files stay in the private property-media bucket."
      >
        <PropertyMediaCms propertyId={property.id} media={property.media} canEdit={canEdit} />
      </ClientSectionCard>

      <ClientSectionCard
        title="Reservations"
        description="Existing stay workflow. The CMS does not replace reservations."
        action={
          <Link href={CLIENT_ROUTES.reservations} className="text-sm text-onwarda-olive hover:underline">
            View reservations
          </Link>
        }
      >
        {property.reservations.length === 0 ? (
          <ClientEmptyState
            title="No reservations yet."
            description="When a stay is created for this property, it will appear here."
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
                      {formatDate(reservation.checkIn)} – {formatDate(reservation.checkOut)}
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
        description="Open items that belong to this property."
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
