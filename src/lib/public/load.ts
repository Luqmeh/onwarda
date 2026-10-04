import "server-only";

import {
  resolveOrganizationBranding,
  type ResolvedOrganizationBranding,
} from "@/lib/branding/resolve";
import { createSupabaseServerClient } from "@/lib/database/server";
import {
  getPublicPropertyContent,
  publicPropertyContentHasPrivateData,
  type PublicPropertyContent,
} from "@/lib/property-cms/safe-content";
import { createPublicOperatorLogoSignedUrl, createPublicPropertyMediaSignedUrl } from "@/lib/public/media";
import { snapshotFromPublicJson } from "@/lib/public/snapshot";
import { publicSlugSchema } from "@/lib/validation/guest-portal";
import type { PropertyAmenity } from "@/lib/property-cms/catalog";

export type PublicOperatorCard = {
  slug: string;
  name: string;
  city: string | null;
  country: string | null;
  capacity: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  amenities: PropertyAmenity[];
  heroUrl: string | null;
  hasVideo: boolean;
  hasTour: boolean;
};

export type PublicOperatorPortfolio = {
  status: "ok";
  organizationSlug: string;
  branding: ResolvedOrganizationBranding;
  properties: PublicOperatorCard[];
};

export type PublicPropertyShowcase = {
  status: "ok";
  organizationSlug: string;
  propertySlug: string;
  branding: ResolvedOrganizationBranding;
  bookingUrl: string | null;
  content: PublicPropertyContent;
  media: Array<PublicPropertyContent["media"][number] & { signedUrl: string | null }>;
};

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function brandingFromJson(
  organization: Record<string, unknown> | null,
  logoUrl: string | null,
): ResolvedOrganizationBranding {
  const slug = typeof organization?.slug === "string" ? organization.slug : "operator";
  const name = typeof organization?.name === "string" ? organization.name : "Operator";

  return resolveOrganizationBranding({
    organizationId: slug,
    organizationName: name,
    branding: {
      display_name: typeof organization?.displayName === "string" ? organization.displayName : null,
      public_description:
        typeof organization?.publicDescription === "string" ? organization.publicDescription : null,
      logo_path: typeof organization?.logoPath === "string" ? organization.logoPath : null,
      primary_color: typeof organization?.primaryColor === "string" ? organization.primaryColor : null,
      secondary_color:
        typeof organization?.secondaryColor === "string" ? organization.secondaryColor : null,
      accent_color: typeof organization?.accentColor === "string" ? organization.accentColor : null,
    },
    logoUrl,
  });
}

export async function loadPublicOperatorPortfolio(
  organizationSlug: string,
): Promise<PublicOperatorPortfolio | { status: "not_found" }> {
  const parsed = publicSlugSchema.safeParse(organizationSlug);

  if (!parsed.success) {
    return { status: "not_found" };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_public_operator_portfolio", {
    p_slug: parsed.data,
  });

  if (error) {
    return { status: "not_found" };
  }

  const payload = asRecord(data);

  if (!payload || payload.status !== "ok") {
    return { status: "not_found" };
  }

  const organization = asRecord(payload.organization);
  const logoUrl = await createPublicOperatorLogoSignedUrl(parsed.data);
  const rows = Array.isArray(payload.properties) ? payload.properties : [];

  const properties = await Promise.all(
    rows.flatMap(async (item) => {
      const row = asRecord(item);

      if (!row || typeof row.slug !== "string" || typeof row.name !== "string") {
        return [];
      }

      const heroUrl =
        typeof row.heroMediaId === "string"
          ? await createPublicPropertyMediaSignedUrl({
              organizationSlug: parsed.data,
              propertySlug: row.slug,
              mediaId: row.heroMediaId,
            })
          : null;

      return [
        {
          slug: row.slug,
          name: row.name,
          city: typeof row.city === "string" ? row.city : null,
          country: typeof row.country === "string" ? row.country : null,
          capacity: typeof row.capacity === "number" ? row.capacity : null,
          bedrooms: typeof row.bedrooms === "number" ? row.bedrooms : null,
          bathrooms: typeof row.bathrooms === "number" ? row.bathrooms : null,
          amenities: Array.isArray(row.amenities)
            ? row.amenities.filter((value): value is PropertyAmenity => typeof value === "string")
            : [],
          heroUrl,
          hasVideo: row.hasVideo === true,
          hasTour: row.hasTour === true,
        } satisfies PublicOperatorCard,
      ];
    }),
  );

  return {
    status: "ok",
    organizationSlug: parsed.data,
    branding: brandingFromJson(organization, logoUrl),
    properties: properties.flat(),
  };
}

export async function loadPublicPropertyShowcase(
  organizationSlug: string,
  propertySlug: string,
): Promise<
  PublicPropertyShowcase | { status: "org_not_found" | "property_not_found" | "not_public" }
> {
  const org = publicSlugSchema.safeParse(organizationSlug);
  const property = publicSlugSchema.safeParse(propertySlug);

  if (!org.success) {
    return { status: "org_not_found" };
  }

  if (!property.success) {
    return { status: "property_not_found" };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_public_property_showcase", {
    p_org_slug: org.data,
    p_property_slug: property.data,
  });

  if (error) {
    return { status: "property_not_found" };
  }

  const payload = asRecord(data);
  const status = payload?.status;

  if (status === "org_not_found" || status === "not_public" || status === "property_not_found") {
    return { status };
  }

  if (status !== "ok") {
    return { status: "property_not_found" };
  }

  const snapshot = snapshotFromPublicJson(payload?.snapshot);

  if (!snapshot) {
    return { status: "property_not_found" };
  }

  const content = getPublicPropertyContent(snapshot);

  if (publicPropertyContentHasPrivateData(content)) {
    return { status: "not_public" };
  }

  const logoUrl = await createPublicOperatorLogoSignedUrl(org.data);
  const media = await Promise.all(
    content.media.map(async (item) => ({
      ...item,
      storagePath: null,
      signedUrl: item.storagePath
        ? await createPublicPropertyMediaSignedUrl({
            organizationSlug: org.data,
            propertySlug: property.data,
            mediaId: item.id,
          })
        : null,
    })),
  );

  return {
    status: "ok",
    organizationSlug: org.data,
    propertySlug: property.data,
    branding: brandingFromJson(asRecord(payload?.organization), logoUrl),
    bookingUrl:
      typeof payload?.bookingUrl === "string" && payload.bookingUrl.startsWith("https://")
        ? payload.bookingUrl
        : null,
    content: {
      ...content,
      media: content.media.map((item) => ({ ...item, storagePath: null })),
    },
    media,
  };
}
