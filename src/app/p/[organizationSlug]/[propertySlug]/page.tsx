import { PublicBookingCta } from "@/components/public/booking-cta";
import { PublicShell, PublicUnavailable } from "@/components/public/public-shell";
import {
  HOUSE_RULE_LABELS,
  HOUSE_RULE_STATE_LABELS,
  PROPERTY_AMENITY_LABELS,
  PROPERTY_CONTENT_FIELD_META,
  PROPERTY_KNOWLEDGE_CMS_CATEGORY_LABELS,
  PROPERTY_TYPE_LABELS,
  type HouseRuleKey,
  type PropertyAmenity,
  type PropertyKnowledgeCmsCategory,
  type PropertyType,
} from "@/lib/property-cms/catalog";
import { recordPublicExperienceEvent } from "@/lib/public/events";
import { loadPublicPropertyShowcase } from "@/lib/public/load";
import { propertyLocation } from "@/lib/workspace/format";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Property",
};

function embedUrl(url: string | null | undefined) {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);

    if (parsed.hostname === "youtu.be") {
      return `https://www.youtube.com/embed/${parsed.pathname.replace("/", "")}`;
    }

    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : url;
    }

    if (parsed.hostname.includes("vimeo.com")) {
      const id = parsed.pathname.split("/").filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : url;
    }
  } catch {
    return null;
  }

  return url;
}

export default async function PublicPropertyPage({
  params,
}: {
  params: Promise<{ organizationSlug: string; propertySlug: string }>;
}) {
  const { organizationSlug, propertySlug } = await params;
  const showcase = await loadPublicPropertyShowcase(organizationSlug, propertySlug);

  if (showcase.status === "org_not_found") {
    return (
      <PublicUnavailable
        title="This collection is not available"
        description="The operator page you are looking for is not public, or the address is incorrect."
      />
    );
  }

  if (showcase.status === "not_public") {
    return (
      <PublicUnavailable
        title="This home is not listed"
        description="The host has not published this property for public viewing."
      />
    );
  }

  if (showcase.status !== "ok") {
    return (
      <PublicUnavailable
        title="This home could not be found"
        description="Check the address or return to the host collection. Public pages never use internal identifiers."
      />
    );
  }

  await recordPublicExperienceEvent({
    type: "public_property_viewed",
    organizationSlug: showcase.organizationSlug,
    propertySlug: showcase.propertySlug,
  });

  const { content, media, branding } = showcase;
  const hero = media.find((item) => item.role === "hero" && item.signedUrl) ?? media.find((item) => item.signedUrl);
  const gallery = media.filter((item) => item.mediaType === "image" && item.signedUrl);
  const video = content.media.find((item) => item.mediaType === "video");
  const tour = content.media.find((item) => item.mediaType === "tour_360");
  const location = propertyLocation(content);
  const typeLabel = content.propertyType
    ? PROPERTY_TYPE_LABELS[content.propertyType as PropertyType]
    : null;
  const neighborhood = [
    content.content.neighborhood,
    content.content.nearby_attractions,
    content.content.transportation,
    content.content.local_information,
  ].filter(Boolean);
  const publicKnowledge = [...content.knowledge].sort((a, b) => a.sortOrder - b.sortOrder);

  if (gallery.length > 0) {
    await recordPublicExperienceEvent({
      type: "public_property_media_viewed",
      organizationSlug: showcase.organizationSlug,
      propertySlug: showcase.propertySlug,
    });
  }

  return (
    <PublicShell branding={branding} organizationSlug={showcase.organizationSlug}>
      <section className="relative">
        {hero?.signedUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hero.signedUrl}
            alt={hero.altText || content.name}
            className="h-[28rem] w-full object-cover sm:h-[36rem]"
          />
        ) : (
          <div
            aria-hidden="true"
            className="h-[22rem] bg-[color-mix(in_srgb,var(--client-primary)_22%,var(--client-background))] sm:h-[28rem]"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-6xl px-4 pb-8 sm:px-6 sm:pb-12">
          <p className="onwarda-kicker text-white/80">{location ?? branding.displayName}</p>
          <h1 className="mt-2 max-w-3xl text-4xl font-medium tracking-tight text-white sm:text-5xl">
            {content.name}
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-white/85 sm:text-base">
            {content.description || "A host-prepared home, shown with the details they chose to share publicly."}
          </p>
          <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/90">
            {content.capacity ? <div>Sleeps {content.capacity}</div> : null}
            {content.bedrooms != null ? <div>{content.bedrooms} bedrooms</div> : null}
            {content.bathrooms != null ? <div>{content.bathrooms} bathrooms</div> : null}
            {typeLabel ? <div>{typeLabel}</div> : null}
          </dl>
          <div className="mt-6">
            <PublicBookingCta
              organizationSlug={showcase.organizationSlug}
              propertySlug={showcase.propertySlug}
              href={showcase.bookingUrl}
            />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-12 px-4 py-12 sm:px-6 sm:py-16">
        <section>
          <h2 className="text-2xl font-medium tracking-tight">About this home</h2>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-onwarda-muted">
            {content.description || "The host has not added a public description yet."}
          </p>
        </section>

        {content.amenities.length > 0 ? (
          <section>
            <h2 className="text-2xl font-medium tracking-tight">Amenities</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {content.amenities.map((amenity) => (
                <li key={amenity} className="rounded-[calc(var(--onwarda-radius)-0.2rem)] bg-onwarda-white px-4 py-3 shadow-onwarda">
                  {PROPERTY_AMENITY_LABELS[amenity as PropertyAmenity] ?? amenity}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {content.houseRules.length > 0 ? (
          <section>
            <h2 className="text-2xl font-medium tracking-tight">House rules</h2>
            <ul className="mt-4 divide-y rounded-[var(--onwarda-radius)] border bg-onwarda-white">
              {content.houseRules.map((rule) => (
                <li key={rule.ruleKey} className="px-4 py-3 sm:flex sm:justify-between">
                  <p className="font-medium">
                    {HOUSE_RULE_LABELS[rule.ruleKey as HouseRuleKey] ?? rule.ruleKey}
                  </p>
                  <p className="text-sm text-onwarda-muted">
                    {HOUSE_RULE_STATE_LABELS[rule.state] ?? rule.state}
                    {rule.details ? ` · ${rule.details}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {gallery.length > 1 ? (
          <section>
            <h2 className="text-2xl font-medium tracking-tight">Gallery</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {gallery.map((item) => (
                <li key={item.id} className="overflow-hidden rounded-[var(--onwarda-radius)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.signedUrl ?? ""}
                    alt={item.altText || item.caption || content.name}
                    className="h-56 w-full object-cover"
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {video?.externalUrl || tour?.externalUrl ? (
          <section className="grid gap-6 lg:grid-cols-2">
            {video?.externalUrl ? (
              <div>
                <h2 className="text-2xl font-medium tracking-tight">Video</h2>
                <div className="mt-4 aspect-video overflow-hidden rounded-[var(--onwarda-radius)] bg-black">
                  <iframe
                    title={`${content.name} video`}
                    src={embedUrl(video.externalUrl) ?? video.externalUrl}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            ) : null}
            {tour?.externalUrl ? (
              <div>
                <h2 className="text-2xl font-medium tracking-tight">360° tour</h2>
                <div className="mt-4 aspect-video overflow-hidden rounded-[var(--onwarda-radius)] bg-black">
                  <iframe
                    title={`${content.name} 360 tour`}
                    src={embedUrl(tour.externalUrl) ?? tour.externalUrl}
                    className="h-full w-full"
                    allowFullScreen
                  />
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {neighborhood.length > 0 ? (
          <section>
            <h2 className="text-2xl font-medium tracking-tight">Neighborhood</h2>
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              {(
                [
                  ["neighborhood", content.content.neighborhood],
                  ["nearby_attractions", content.content.nearby_attractions],
                  ["transportation", content.content.transportation],
                  ["local_information", content.content.local_information],
                ] as const
              )
                .filter(([, body]) => body)
                .map(([field, body]) => (
                  <article key={field} className="rounded-[var(--onwarda-radius)] bg-onwarda-white p-5 shadow-onwarda">
                    <h3 className="font-medium">{PROPERTY_CONTENT_FIELD_META[field].label}</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-onwarda-muted">
                      {body}
                    </p>
                  </article>
                ))}
            </div>
          </section>
        ) : null}

        {publicKnowledge.length > 0 ? (
          <section>
            <h2 className="text-2xl font-medium tracking-tight">Good to know</h2>
            <div className="mt-4 space-y-4">
              {publicKnowledge.map((entry) => (
                <article key={entry.id} className="rounded-[var(--onwarda-radius)] border bg-onwarda-white p-5">
                  <p className="onwarda-kicker">
                    {PROPERTY_KNOWLEDGE_CMS_CATEGORY_LABELS[
                      entry.category as PropertyKnowledgeCmsCategory
                    ] ?? entry.category}
                  </p>
                  <h3 className="mt-2 font-medium">{entry.title || "Note"}</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-onwarda-muted">
                    {entry.body}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-[var(--onwarda-radius)] bg-[color-mix(in_srgb,var(--client-primary)_10%,var(--client-background))] px-6 py-8 text-center">
          <h2 className="text-2xl font-medium tracking-tight">Plan your stay</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-onwarda-muted">
            Booking stays with the host. Onwarda does not take payment on this page.
          </p>
          <div className="mt-5 flex justify-center">
            <PublicBookingCta
              organizationSlug={showcase.organizationSlug}
              propertySlug={showcase.propertySlug}
              href={showcase.bookingUrl}
            />
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
