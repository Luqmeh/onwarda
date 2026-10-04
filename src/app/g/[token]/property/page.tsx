import { GuestEmptyState, GuestPageHeader } from "@/components/guest/guest-journey";
import { GuestShell, GuestUnavailable } from "@/components/guest/guest-shell";
import {
  PROPERTY_AMENITY_LABELS,
  PROPERTY_CONTENT_FIELD_META,
  type PropertyAmenity,
} from "@/lib/property-cms/catalog";
import { loadGuestStay } from "@/lib/guest-portal/load";
import { propertyLocation } from "@/lib/workspace/format";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Property information",
};

export default async function GuestPropertyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const stay = await loadGuestStay(token);

  if (stay.status !== "ok") {
    return <GuestUnavailable status={stay.status} />;
  }

  const contact = stay.content.content.contact_information;
  const neighborhood = (
    ["neighborhood", "nearby_attractions", "transportation", "local_information"] as const
  ).flatMap((field) => {
    const body = stay.content.content[field];
    return body ? [{ field, body, label: PROPERTY_CONTENT_FIELD_META[field].label }] : [];
  });
  const hasDetails = Boolean(
    stay.content.description || stay.content.amenities.length > 0 || contact || neighborhood.length > 0,
  );

  return (
    <GuestShell stay={stay}>
      <GuestPageHeader
        token={stay.token}
        section="Home"
        title={stay.content.name}
        description={propertyLocation(stay.content) ?? stay.branding.displayName ?? undefined}
      />
      {stay.content.description ? (
        <p className="text-sm leading-relaxed">{stay.content.description}</p>
      ) : null}
      <dl className="mt-5 grid grid-cols-3 gap-3 text-center text-sm">
        <div className="rounded-[var(--onwarda-radius)] bg-onwarda-white px-2 py-3">
          <dt className="text-onwarda-muted">Guests</dt>
          <dd className="mt-1 font-medium">{stay.content.capacity ?? "—"}</dd>
        </div>
        <div className="rounded-[var(--onwarda-radius)] bg-onwarda-white px-2 py-3">
          <dt className="text-onwarda-muted">Bedrooms</dt>
          <dd className="mt-1 font-medium">{stay.content.bedrooms ?? "—"}</dd>
        </div>
        <div className="rounded-[var(--onwarda-radius)] bg-onwarda-white px-2 py-3">
          <dt className="text-onwarda-muted">Baths</dt>
          <dd className="mt-1 font-medium">{stay.content.bathrooms ?? "—"}</dd>
        </div>
      </dl>
      {stay.content.amenities.length > 0 ? (
        <ul className="mt-5 flex flex-wrap gap-2">
          {stay.content.amenities.map((amenity) => (
            <li key={amenity} className="rounded-full bg-onwarda-white px-3 py-1 text-xs">
              {PROPERTY_AMENITY_LABELS[amenity as PropertyAmenity] ?? amenity}
            </li>
          ))}
        </ul>
      ) : null}
      {contact ? (
        <section className="mt-6 rounded-[var(--onwarda-radius)] bg-onwarda-white p-4 shadow-onwarda">
          <h2 className="font-medium">Contact</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-onwarda-muted">{contact}</p>
        </section>
      ) : null}
      {neighborhood.map((item) => (
        <section key={item.field} className="mt-4 rounded-[var(--onwarda-radius)] bg-onwarda-white p-4">
          <h2 className="font-medium">{item.label}</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-onwarda-muted">{item.body}</p>
        </section>
      ))}
      {!hasDetails ? (
        <div className="mt-6">
          <GuestEmptyState
            title="Property information"
            body="Additional property details have not been provided for this stay."
          />
        </div>
      ) : null}
    </GuestShell>
  );
}
