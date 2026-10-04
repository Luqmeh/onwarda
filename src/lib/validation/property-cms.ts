import { z } from "zod";

import {
  CONTENT_VISIBILITY,
  HOUSE_RULE_KEYS,
  HOUSE_RULE_STATES,
  PROPERTY_AMENITIES,
  PROPERTY_CONTENT_FIELDS,
  PROPERTY_CONTENT_LANGUAGES,
  PROPERTY_MEDIA_ROLES,
  PROPERTY_MEDIA_TYPES,
  isAllowedContentVisibility,
  type PropertyContentField,
} from "@/lib/property-cms/catalog";
import { normalizeExternalMediaUrl } from "@/lib/property-cms/urls";
import { PROPERTY_KNOWLEDGE_CATEGORIES, PROPERTY_STATUSES, PROPERTY_TYPES } from "@/types/enums";
import { nonEmptyStringSchema, uuidSchema } from "@/lib/validation/common";

const emptyToUndefined = z
  .union([z.string(), z.undefined(), z.null()])
  .transform((value) => {
    const trimmed = String(value ?? "").trim();
    return trimmed.length === 0 ? undefined : trimmed;
  });

const optionalText = (max: number) =>
  emptyToUndefined.pipe(z.union([z.undefined(), z.string().max(max)]));

const timeSchema = emptyToUndefined.pipe(
  z.union([
    z.undefined(),
    z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/, "Enter a valid time."),
  ]),
);

const optionalInt = (min: number, max: number) =>
  emptyToUndefined.pipe(
    z.union([
      z.undefined(),
      z
        .string()
        .regex(/^\d+$/)
        .transform((value) => Number.parseInt(value, 10))
        .pipe(z.number().int().min(min).max(max)),
    ]),
  );

const optionalNumber = (min: number, max: number) =>
  emptyToUndefined.pipe(
    z.union([
      z.undefined(),
      z
        .string()
        .regex(/^\d+(?:\.\d)?$/)
        .transform((value) => Number.parseFloat(value))
        .pipe(z.number().min(min).max(max)),
    ]),
  );

export const propertyStatusInputSchema = z.enum([
  PROPERTY_STATUSES.DRAFT,
  PROPERTY_STATUSES.ACTIVE,
  PROPERTY_STATUSES.INACTIVE,
]);

export const createWorkspacePropertySchema = z.object({
  name: nonEmptyStringSchema.max(120),
  internalIdentifier: optionalText(80).optional(),
  propertyType: emptyToUndefined.pipe(z.union([z.undefined(), z.enum(PROPERTY_TYPES)])).optional(),
  city: optionalText(80).optional(),
  country: optionalText(80).optional(),
  status: propertyStatusInputSchema.default(PROPERTY_STATUSES.DRAFT),
});

export const updateWorkspacePropertyBasicsSchema = z.object({
  name: nonEmptyStringSchema.max(120),
  internalIdentifier: optionalText(80).optional(),
  propertyType: emptyToUndefined.pipe(z.union([z.undefined(), z.enum(PROPERTY_TYPES)])).optional(),
  address: optionalText(200).optional(),
  city: optionalText(80).optional(),
  country: optionalText(80).optional(),
  capacity: optionalInt(1, 100).optional(),
  bedrooms: optionalInt(0, 50).optional(),
  bathrooms: optionalNumber(0, 50).optional(),
  checkInTime: timeSchema.optional(),
  checkOutTime: timeSchema.optional(),
  description: optionalText(500).optional(),
  languages: z.array(z.enum(PROPERTY_CONTENT_LANGUAGES)).default([]),
  status: propertyStatusInputSchema,
  isListedPublicly: z
    .union([z.literal("on"), z.literal("true"), z.boolean(), z.undefined(), z.null()])
    .optional()
    .transform((value) => value === true || value === "on" || value === "true"),
  bookingUrl: emptyToUndefined
    .optional()
    .pipe(
      z.union([
        z.undefined(),
        z
          .string()
          .url()
          .refine((value) => value.startsWith("https://"), "Use an https booking URL.")
          .max(500),
      ]),
    ),
});

export const updateWorkspacePropertySchema = updateWorkspacePropertyBasicsSchema;

export const updatePropertyAmenitiesSchema = z.object({
  amenities: z.array(z.enum(PROPERTY_AMENITIES)).default([]),
});

const houseRuleRowSchema = z.object({
  ruleKey: z.enum(HOUSE_RULE_KEYS),
  state: z.enum(HOUSE_RULE_STATES),
  details: optionalText(2000),
  visibility: z.enum(CONTENT_VISIBILITY),
});

export const updatePropertyHouseRulesSchema = z.object({
  rules: z.array(houseRuleRowSchema),
});

export const updatePropertyContentSchema = z
  .object({
    fields: z.array(
      z.object({
        fieldKey: z.enum(PROPERTY_CONTENT_FIELDS),
        body: optionalText(8000),
        visibility: z.enum(CONTENT_VISIBILITY),
      }),
    ),
  })
  .superRefine((value, context) => {
    for (const [index, field] of value.fields.entries()) {
      if (
        field.body &&
        !isAllowedContentVisibility(field.fieldKey as PropertyContentField, field.visibility)
      ) {
        context.addIssue({
          code: "custom",
          path: ["fields", index, "visibility"],
          message: "That visibility is not allowed for this field.",
        });
      }
    }
  });

export const createWorkspaceKnowledgeSchema = z.object({
  propertyId: uuidSchema,
  category: z.enum(PROPERTY_KNOWLEDGE_CATEGORIES),
  title: nonEmptyStringSchema.max(160),
  body: nonEmptyStringSchema.max(8000),
  locale: z.enum(["en", "fr", "ar"]).default("en"),
  visibility: z.enum(CONTENT_VISIBILITY).default(CONTENT_VISIBILITY.GUEST),
  status: z.enum(["draft", "published"]).default("published"),
  sortOrder: optionalInt(0, 1000).transform((value) => value ?? 0),
});

export const updateWorkspaceKnowledgeSchema = z.object({
  knowledgeId: uuidSchema,
  category: z.enum(PROPERTY_KNOWLEDGE_CATEGORIES),
  title: nonEmptyStringSchema.max(160),
  body: nonEmptyStringSchema.max(8000),
  visibility: z.enum(CONTENT_VISIBILITY),
  status: z.enum(["draft", "published", "archived"]),
  sortOrder: optionalInt(0, 1000).transform((value) => value ?? 0),
});

export const deleteWorkspaceKnowledgeSchema = z.object({
  knowledgeId: uuidSchema,
});

export const propertyImageMetaSchema = z.object({
  role: z.enum(PROPERTY_MEDIA_ROLES).default(PROPERTY_MEDIA_ROLES.GALLERY),
  caption: optionalText(200),
  altText: optionalText(200),
  visibility: z.enum(CONTENT_VISIBILITY).default(CONTENT_VISIBILITY.PUBLIC),
});

export const updatePropertyImageMetaSchema = z.object({
  mediaId: uuidSchema,
  role: z.enum(PROPERTY_MEDIA_ROLES),
  caption: optionalText(200),
  altText: optionalText(200),
  visibility: z.enum(CONTENT_VISIBILITY),
  sortOrder: optionalInt(0, 1000).transform((value) => value ?? 0),
});

export const deletePropertyMediaSchema = z.object({
  mediaId: uuidSchema,
});

export const updatePropertyExternalMediaSchema = z
  .object({
    videoUrl: optionalText(500),
    tourUrl: optionalText(500),
    instructionalUrl: optionalText(500),
  })
  .superRefine((value, context) => {
    if (value.videoUrl && !normalizeExternalMediaUrl(value.videoUrl, PROPERTY_MEDIA_TYPES.VIDEO)) {
      context.addIssue({
        code: "custom",
        path: ["videoUrl"],
        message: "Use an https YouTube or Vimeo URL.",
      });
    }

    if (
      value.tourUrl &&
      !normalizeExternalMediaUrl(value.tourUrl, PROPERTY_MEDIA_TYPES.TOUR_360)
    ) {
      context.addIssue({
        code: "custom",
        path: ["tourUrl"],
        message: "Use an https Matterport, Kuula, or YouTube tour URL.",
      });
    }

    if (
      value.instructionalUrl &&
      !normalizeExternalMediaUrl(
        value.instructionalUrl,
        PROPERTY_MEDIA_TYPES.INSTRUCTIONAL_VIDEO,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["instructionalUrl"],
        message: "Use an https YouTube or Vimeo URL.",
      });
    }
  });

export const reorderPropertyImagesSchema = z.object({
  mediaIds: z.array(uuidSchema).min(1),
});
