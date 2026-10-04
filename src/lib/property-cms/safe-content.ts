import {
  CONTENT_VISIBILITY,
  type ContentVisibility,
  type HouseRuleKey,
  type HouseRuleState,
  type PropertyAmenity,
  type PropertyContentField,
  type PropertyContentLanguage,
  type PropertyMediaRole,
  type PropertyMediaType,
} from "@/lib/property-cms/catalog";
import type { PropertyType } from "@/types/enums";

export type PropertyCmsAudience = "public" | "guest" | "operator";

export type PropertyCmsSnapshot = {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  internalIdentifier: string | null;
  propertyType: PropertyType | null;
  address: string | null;
  city: string | null;
  country: string | null;
  capacity: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  description: string | null;
  status: string;
  languages: PropertyContentLanguage[];
  amenities: PropertyAmenity[];
  houseRules: Array<{
    ruleKey: HouseRuleKey;
    state: HouseRuleState;
    details: string | null;
    visibility: ContentVisibility;
    sortOrder: number;
  }>;
  content: Array<{
    fieldKey: PropertyContentField;
    body: string;
    visibility: ContentVisibility;
  }>;
  knowledge: Array<{
    id: string;
    title: string | null;
    category: string;
    body: string;
    locale: string;
    status: string;
    visibility: ContentVisibility;
    sortOrder: number;
  }>;
  media: Array<{
    id: string;
    mediaType: PropertyMediaType;
    role: PropertyMediaRole | null;
    storagePath: string | null;
    externalUrl: string | null;
    sortOrder: number;
    caption: string | null;
    altText: string | null;
    visibility: ContentVisibility;
  }>;
};

function visibilityRank(visibility: ContentVisibility) {
  if (visibility === CONTENT_VISIBILITY.PUBLIC) {
    return 0;
  }

  if (visibility === CONTENT_VISIBILITY.GUEST) {
    return 1;
  }

  return 2;
}

function audienceRank(audience: Exclude<PropertyCmsAudience, "operator">) {
  return audience === "public" ? 0 : 1;
}

function isVisibleTo(
  visibility: ContentVisibility,
  audience: Exclude<PropertyCmsAudience, "operator">,
) {
  return visibilityRank(visibility) <= audienceRank(audience);
}

function publishedKnowledgeVisible(
  entry: PropertyCmsSnapshot["knowledge"][number],
  audience: Exclude<PropertyCmsAudience, "operator">,
) {
  return entry.status === "published" && isVisibleTo(entry.visibility, audience);
}

export type PublicPropertyContent = {
  id: string;
  name: string;
  propertyType: PropertyType | null;
  city: string | null;
  country: string | null;
  address: string | null;
  capacity: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  description: string | null;
  languages: PropertyContentLanguage[];
  amenities: PropertyAmenity[];
  houseRules: Array<{
    ruleKey: HouseRuleKey;
    state: HouseRuleState;
    details: string | null;
  }>;
  content: Partial<Record<PropertyContentField, string>>;
  knowledge: Array<{
    id: string;
    title: string | null;
    category: string;
    body: string;
    locale: string;
    sortOrder: number;
  }>;
  media: Array<{
    id: string;
    mediaType: PropertyMediaType;
    role: PropertyMediaRole | null;
    storagePath: string | null;
    externalUrl: string | null;
    sortOrder: number;
    caption: string | null;
    altText: string | null;
  }>;
};

export type GuestPropertyContent = PublicPropertyContent;

function projectForAudience(
  snapshot: PropertyCmsSnapshot,
  audience: Exclude<PropertyCmsAudience, "operator">,
): PublicPropertyContent {
  const content: Partial<Record<PropertyContentField, string>> = {};

  for (const field of snapshot.content) {
    if (isVisibleTo(field.visibility, audience)) {
      content[field.fieldKey] = field.body;
    }
  }

  return {
    id: snapshot.id,
    name: snapshot.name,
    propertyType: snapshot.propertyType,
    city: snapshot.city,
    country: snapshot.country,
    address: snapshot.address,
    capacity: snapshot.capacity,
    bedrooms: snapshot.bedrooms,
    bathrooms: snapshot.bathrooms,
    checkInTime: snapshot.checkInTime,
    checkOutTime: snapshot.checkOutTime,
    description: snapshot.description,
    languages: [...snapshot.languages],
    amenities: [...snapshot.amenities],
    houseRules: snapshot.houseRules
      .filter((rule) => isVisibleTo(rule.visibility, audience))
      .map((rule) => ({
        ruleKey: rule.ruleKey,
        state: rule.state,
        details: rule.details,
      })),
    content,
    knowledge: snapshot.knowledge
      .filter((entry) => publishedKnowledgeVisible(entry, audience))
      .map((entry) => ({
        id: entry.id,
        title: entry.title,
        category: entry.category,
        body: entry.body,
        locale: entry.locale,
        sortOrder: entry.sortOrder,
      })),
    media: snapshot.media
      .filter((item) => isVisibleTo(item.visibility, audience))
      .map((item) => ({
        id: item.id,
        mediaType: item.mediaType,
        role: item.role,
        storagePath: item.storagePath,
        externalUrl: item.externalUrl,
        sortOrder: item.sortOrder,
        caption: item.caption,
        altText: item.altText,
      })),
  };
}

export function getPublicPropertyContent(snapshot: PropertyCmsSnapshot): PublicPropertyContent {
  return projectForAudience(snapshot, "public");
}

export function getGuestPropertyContent(snapshot: PropertyCmsSnapshot): GuestPropertyContent {
  return projectForAudience(snapshot, "guest");
}

export function publicPropertyContentHasPrivateData(content: PublicPropertyContent) {
  const serialized = JSON.stringify(content);

  return (
    serialized.includes("internalIdentifier") ||
    Boolean(content.content.private_notes) ||
    Boolean(content.content.lockbox_instructions) ||
    Boolean(content.content.smart_lock_instructions) ||
    Boolean(content.content.key_retrieval) ||
    Boolean(content.content.building_entry)
  );
}
