import type { PropertyCmsSnapshot } from "@/lib/property-cms/safe-content";
import type {
  ContentVisibility,
  HouseRuleKey,
  HouseRuleState,
  PropertyAmenity,
  PropertyContentField,
  PropertyContentLanguage,
  PropertyMediaRole,
  PropertyMediaType,
} from "@/lib/property-cms/catalog";
import type { PropertyType } from "@/types/enums";

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

export function snapshotFromPublicJson(value: unknown): PropertyCmsSnapshot | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<string, unknown>;
  const id = asString(row.id);
  const organizationId = asString(row.organizationId);
  const name = asString(row.name);
  const slug = asString(row.slug);

  if (!id || !organizationId || !name || !slug) {
    return null;
  }

  return {
    id,
    organizationId,
    name,
    slug,
    internalIdentifier: null,
    propertyType: (asNullableString(row.propertyType) as PropertyType | null) ?? null,
    address: asNullableString(row.address),
    city: asNullableString(row.city),
    country: asNullableString(row.country),
    capacity: asNumber(row.capacity),
    bedrooms: asNumber(row.bedrooms),
    bathrooms: asNumber(row.bathrooms),
    checkInTime: asNullableString(row.checkInTime),
    checkOutTime: asNullableString(row.checkOutTime),
    description: asNullableString(row.description),
    status: asString(row.status) || "active",
    languages: asArray(row.languages).filter(
      (item): item is PropertyContentLanguage => typeof item === "string",
    ),
    amenities: asArray(row.amenities).filter(
      (item): item is PropertyAmenity => typeof item === "string",
    ),
    houseRules: asArray(row.houseRules).flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [];
      }

      const rule = item as Record<string, unknown>;
      return [
        {
          ruleKey: asString(rule.ruleKey) as HouseRuleKey,
          state: asString(rule.state) as HouseRuleState,
          details: asNullableString(rule.details),
          visibility: asString(rule.visibility) as ContentVisibility,
          sortOrder: asNumber(rule.sortOrder) ?? 0,
        },
      ];
    }),
    content: asArray(row.content).flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [];
      }

      const field = item as Record<string, unknown>;
      const body = asString(field.body);

      if (!body) {
        return [];
      }

      return [
        {
          fieldKey: asString(field.fieldKey) as PropertyContentField,
          body,
          visibility: asString(field.visibility) as ContentVisibility,
        },
      ];
    }),
    knowledge: asArray(row.knowledge).flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [];
      }

      const entry = item as Record<string, unknown>;
      return [
        {
          id: asString(entry.id),
          title: asNullableString(entry.title),
          category: asString(entry.category),
          body: asString(entry.body),
          locale: asString(entry.locale) || "en",
          status: asString(entry.status) || "published",
          visibility: asString(entry.visibility) as ContentVisibility,
          sortOrder: asNumber(entry.sortOrder) ?? 0,
        },
      ];
    }),
    media: asArray(row.media).flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [];
      }

      const media = item as Record<string, unknown>;
      return [
        {
          id: asString(media.id),
          mediaType: asString(media.mediaType) as PropertyMediaType,
          role: (asNullableString(media.role) as PropertyMediaRole | null) ?? null,
          storagePath: asNullableString(media.storagePath),
          externalUrl: asNullableString(media.externalUrl),
          sortOrder: asNumber(media.sortOrder) ?? 0,
          caption: asNullableString(media.caption),
          altText: asNullableString(media.altText),
          visibility: asString(media.visibility) as ContentVisibility,
        },
      ];
    }),
  };
}
