import Link from "next/link";

import { publicPropertyPath } from "@/config/app";
import { PROPERTY_AMENITY_LABELS, type PropertyAmenity } from "@/lib/property-cms/catalog";
import { propertyLocation } from "@/lib/workspace/format";
import type { PublicOperatorCard } from "@/lib/public/load";

export function PublicPropertyCard({
  organizationSlug,
  property,
}: {
  organizationSlug: string;
  property: PublicOperatorCard;
}) {
  const href = publicPropertyPath(organizationSlug, property.slug);
  const location = propertyLocation(property);
  const amenities = property.amenities.slice(0, 4);

  return (
    <article className="overflow-hidden rounded-[var(--onwarda-radius)] border bg-onwarda-white shadow-onwarda">
      <Link href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--client-primary)]">
        {property.heroUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={property.heroUrl}
            alt={property.name}
            className="h-56 w-full object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-56 items-end bg-[color-mix(in_srgb,var(--client-primary)_18%,var(--client-background))] p-5"
          >
            <p className="text-lg font-medium">{property.name}</p>
          </div>
        )}
      </Link>
      <div className="space-y-3 p-5">
        <div>
          <h2 className="text-lg font-medium tracking-tight">
            <Link href={href} className="rounded-sm hover:underline">
              {property.name}
            </Link>
          </h2>
          <p className="mt-1 text-sm text-onwarda-muted">{location ?? "Location to be shared"}</p>
        </div>
        <p className="text-sm text-onwarda-muted">
          {[
            property.capacity ? `Sleeps ${property.capacity}` : null,
            property.bedrooms != null ? `${property.bedrooms} bedrooms` : null,
            property.bathrooms != null ? `${property.bathrooms} bathrooms` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "Details coming soon"}
        </p>
        {amenities.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {amenities.map((amenity) => (
              <li
                key={amenity}
                className="rounded-full bg-onwarda-cream px-2.5 py-1 text-xs"
              >
                {PROPERTY_AMENITY_LABELS[amenity as PropertyAmenity] ?? amenity}
              </li>
            ))}
          </ul>
        ) : null}
        {property.hasVideo || property.hasTour ? (
          <p className="text-xs text-onwarda-muted">
            {[property.hasVideo ? "Video" : null, property.hasTour ? "360° tour" : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
        <Link
          href={href}
          className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--client-primary)] underline-offset-4 hover:underline"
        >
          View this home
        </Link>
      </div>
    </article>
  );
}
