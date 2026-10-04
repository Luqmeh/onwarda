export const CONTENT_VISIBILITY = {
  PUBLIC: "public",
  GUEST: "guest",
  PRIVATE: "private",
} as const;

export type ContentVisibility =
  (typeof CONTENT_VISIBILITY)[keyof typeof CONTENT_VISIBILITY];

export const PROPERTY_TYPES = {
  APARTMENT: "apartment",
  HOUSE: "house",
  RIAD: "riad",
  VILLA: "villa",
  ROOM: "room",
  HOTEL_ROOM: "hotel_room",
  GUESTHOUSE: "guesthouse",
  OTHER: "other",
} as const;

export type PropertyType = (typeof PROPERTY_TYPES)[keyof typeof PROPERTY_TYPES];

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  apartment: "Apartment",
  house: "House",
  riad: "Riad",
  villa: "Villa",
  room: "Room",
  hotel_room: "Hotel room",
  guesthouse: "Guesthouse",
  other: "Other",
};

export const PROPERTY_CONTENT_LANGUAGES = {
  ENGLISH: "en",
  FRENCH: "fr",
  ARABIC: "ar",
  SPANISH: "es",
  GERMAN: "de",
  ITALIAN: "it",
} as const;

export type PropertyContentLanguage =
  (typeof PROPERTY_CONTENT_LANGUAGES)[keyof typeof PROPERTY_CONTENT_LANGUAGES];

export const PROPERTY_CONTENT_LANGUAGE_LABELS: Record<
  PropertyContentLanguage,
  string
> = {
  en: "English",
  fr: "French",
  ar: "Arabic",
  es: "Spanish",
  de: "German",
  it: "Italian",
};

export const PROPERTY_AMENITIES = {
  WIFI: "wifi",
  AIR_CONDITIONING: "air_conditioning",
  HEATING: "heating",
  KITCHEN: "kitchen",
  TV: "tv",
  WASHER: "washer",
  PARKING: "parking",
  POOL: "pool",
  WORKSPACE: "workspace",
  BALCONY: "balcony",
  TERRACE: "terrace",
} as const;

export type PropertyAmenity =
  (typeof PROPERTY_AMENITIES)[keyof typeof PROPERTY_AMENITIES];

export const PROPERTY_AMENITY_LABELS: Record<PropertyAmenity, string> = {
  wifi: "Wi-Fi",
  air_conditioning: "Air conditioning",
  heating: "Heating",
  kitchen: "Kitchen",
  tv: "TV",
  washer: "Washer",
  parking: "Parking",
  pool: "Pool",
  workspace: "Workspace",
  balcony: "Balcony",
  terrace: "Terrace",
};

export const HOUSE_RULE_KEYS = {
  SMOKING: "smoking",
  PETS: "pets",
  PARTIES: "parties",
  VISITORS: "visitors",
  QUIET_HOURS: "quiet_hours",
  CHECKOUT: "checkout",
} as const;

export type HouseRuleKey = (typeof HOUSE_RULE_KEYS)[keyof typeof HOUSE_RULE_KEYS];

export const HOUSE_RULE_LABELS: Record<HouseRuleKey, string> = {
  smoking: "Smoking",
  pets: "Pets",
  parties: "Parties",
  visitors: "Visitors",
  quiet_hours: "Quiet hours",
  checkout: "Checkout requirements",
};

export const HOUSE_RULE_STATES = {
  ALLOWED: "allowed",
  NOT_ALLOWED: "not_allowed",
  LIMITED: "limited",
  UNSPECIFIED: "unspecified",
} as const;

export type HouseRuleState =
  (typeof HOUSE_RULE_STATES)[keyof typeof HOUSE_RULE_STATES];

export const HOUSE_RULE_STATE_LABELS: Record<HouseRuleState, string> = {
  allowed: "Allowed",
  not_allowed: "Not allowed",
  limited: "Limited",
  unspecified: "Not specified",
};

export const PROPERTY_CONTENT_FIELDS = {
  NEIGHBORHOOD: "neighborhood",
  NEARBY_ATTRACTIONS: "nearby_attractions",
  TRANSPORTATION: "transportation",
  LOCAL_INFORMATION: "local_information",
  ARRIVAL_INSTRUCTIONS: "arrival_instructions",
  PARKING_INSTRUCTIONS: "parking_instructions",
  BUILDING_ENTRY: "building_entry",
  KEY_RETRIEVAL: "key_retrieval",
  LOCKBOX_INSTRUCTIONS: "lockbox_instructions",
  SMART_LOCK_INSTRUCTIONS: "smart_lock_instructions",
  RECEPTION_INSTRUCTIONS: "reception_instructions",
  CONTACT_INFORMATION: "contact_information",
  PRIVATE_NOTES: "private_notes",
} as const;

export type PropertyContentField =
  (typeof PROPERTY_CONTENT_FIELDS)[keyof typeof PROPERTY_CONTENT_FIELDS];

export const PROPERTY_CONTENT_FIELD_META: Record<
  PropertyContentField,
  {
    label: string;
    description: string;
    defaultVisibility: ContentVisibility;
    allowPublic: boolean;
    allowGuest: boolean;
    group: "content" | "access" | "private";
  }
> = {
  neighborhood: {
    label: "Neighborhood",
    description: "What the area around the home is like.",
    defaultVisibility: "public",
    allowPublic: true,
    allowGuest: true,
    group: "content",
  },
  nearby_attractions: {
    label: "Nearby attractions",
    description: "Places worth knowing about, without turning this into a map product.",
    defaultVisibility: "public",
    allowPublic: true,
    allowGuest: true,
    group: "content",
  },
  transportation: {
    label: "Transportation",
    description: "Airport transfers, taxis, tram, and walking context.",
    defaultVisibility: "public",
    allowPublic: true,
    allowGuest: true,
    group: "content",
  },
  local_information: {
    label: "Local information",
    description: "Useful neighborhood context that operators want to reuse later.",
    defaultVisibility: "public",
    allowPublic: true,
    allowGuest: true,
    group: "content",
  },
  arrival_instructions: {
    label: "Arrival instructions",
    description: "How guests should arrive. Keep lock codes on guest or private visibility.",
    defaultVisibility: "guest",
    allowPublic: true,
    allowGuest: true,
    group: "access",
  },
  parking_instructions: {
    label: "Parking",
    description: "Public parking notes can be public. Exact access details should stay guest-only.",
    defaultVisibility: "guest",
    allowPublic: true,
    allowGuest: true,
    group: "access",
  },
  building_entry: {
    label: "Building entry",
    description: "How to enter the building. Not public by default.",
    defaultVisibility: "guest",
    allowPublic: false,
    allowGuest: true,
    group: "access",
  },
  key_retrieval: {
    label: "Key retrieval",
    description: "Where and how keys are collected. Never public.",
    defaultVisibility: "guest",
    allowPublic: false,
    allowGuest: true,
    group: "access",
  },
  lockbox_instructions: {
    label: "Lockbox",
    description: "Lockbox location and codes. Guest or private only.",
    defaultVisibility: "guest",
    allowPublic: false,
    allowGuest: true,
    group: "access",
  },
  smart_lock_instructions: {
    label: "Smart lock",
    description: "Codes and app instructions. Guest or private only.",
    defaultVisibility: "guest",
    allowPublic: false,
    allowGuest: true,
    group: "access",
  },
  reception_instructions: {
    label: "Reception",
    description: "Desk hours and how to check in with staff.",
    defaultVisibility: "guest",
    allowPublic: false,
    allowGuest: true,
    group: "access",
  },
  contact_information: {
    label: "Contact information",
    description: "Who guests should call. A public phone number can be public; private numbers should not.",
    defaultVisibility: "guest",
    allowPublic: true,
    allowGuest: true,
    group: "access",
  },
  private_notes: {
    label: "Internal notes",
    description: "Operator-only notes. Never guest or public.",
    defaultVisibility: "private",
    allowPublic: false,
    allowGuest: false,
    group: "private",
  },
};

export const PROPERTY_MEDIA_TYPES = {
  IMAGE: "image",
  VIDEO: "video",
  TOUR_360: "tour_360",
  INSTRUCTIONAL_VIDEO: "instructional_video",
} as const;

export type PropertyMediaType =
  (typeof PROPERTY_MEDIA_TYPES)[keyof typeof PROPERTY_MEDIA_TYPES];

export const PROPERTY_MEDIA_ROLES = {
  HERO: "hero",
  GALLERY: "gallery",
} as const;

export type PropertyMediaRole =
  (typeof PROPERTY_MEDIA_ROLES)[keyof typeof PROPERTY_MEDIA_ROLES];

export const PROPERTY_KNOWLEDGE_CMS_CATEGORIES = {
  HOUSE_RULES: "house_rules",
  CHECK_IN: "check_in",
  CHECK_OUT: "check_out",
  WIFI: "wifi",
  ACCESS: "access",
  FAQ: "faq",
  TUTORIAL: "tutorial",
  AC: "ac",
  TV: "tv",
  STOVE: "stove",
  WASHER: "washer",
  HOT_WATER: "hot_water",
  COFFEE_MACHINE: "coffee_machine",
  GARBAGE: "garbage",
  POOL: "pool",
  DOOR_ACCESS: "door_access",
  OTHER: "other",
} as const;

export type PropertyKnowledgeCmsCategory =
  (typeof PROPERTY_KNOWLEDGE_CMS_CATEGORIES)[keyof typeof PROPERTY_KNOWLEDGE_CMS_CATEGORIES];

export const PROPERTY_KNOWLEDGE_CMS_CATEGORY_LABELS: Record<
  PropertyKnowledgeCmsCategory,
  string
> = {
  house_rules: "House rules",
  check_in: "Check-in",
  check_out: "Checkout",
  wifi: "Wi-Fi",
  access: "Door/access",
  faq: "FAQ",
  tutorial: "Tutorial",
  ac: "AC",
  tv: "TV",
  stove: "Stove",
  washer: "Washer",
  hot_water: "Hot water",
  coffee_machine: "Coffee machine",
  garbage: "Garbage",
  pool: "Pool",
  door_access: "Door/access",
  other: "Other",
};

export const EXTERNAL_MEDIA_HOSTS = {
  video: [
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "youtu.be",
    "vimeo.com",
    "www.vimeo.com",
    "player.vimeo.com",
  ],
  tour_360: [
    "matterport.com",
    "www.matterport.com",
    "my.matterport.com",
    "kuula.co",
    "www.kuula.co",
    "youtube.com",
    "www.youtube.com",
    "youtu.be",
  ],
  instructional_video: [
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "youtu.be",
    "vimeo.com",
    "www.vimeo.com",
    "player.vimeo.com",
  ],
} as const;

export function isAllowedContentVisibility(
  field: PropertyContentField,
  visibility: ContentVisibility,
) {
  const meta = PROPERTY_CONTENT_FIELD_META[field];

  if (visibility === CONTENT_VISIBILITY.PUBLIC) {
    return meta.allowPublic;
  }

  if (visibility === CONTENT_VISIBILITY.GUEST) {
    return meta.allowGuest;
  }

  return true;
}

export function contentFieldsForGroup(group: "content" | "access" | "private") {
  return (Object.keys(PROPERTY_CONTENT_FIELD_META) as PropertyContentField[]).filter(
    (field) => PROPERTY_CONTENT_FIELD_META[field].group === group,
  );
}
