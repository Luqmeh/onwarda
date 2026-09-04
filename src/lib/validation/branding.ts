import { z } from "zod";

import {
  isSafeBrandColor,
  normalizeBrandColor,
} from "@/lib/branding/colors";
import { nonEmptyStringSchema } from "@/lib/validation/common";

const UNSAFE_COLOR = /url\s*\(|javascript:|expression\s*\(|var\s*\(|--|[{};<>]|style=|@import/i;

export const brandColorSchema = z
  .string()
  .trim()
  .min(1)
  .max(7)
  .refine((value) => !UNSAFE_COLOR.test(value), "Color must be a 6-digit hex value.")
  .refine((value) => isSafeBrandColor(value), "Color must be a 6-digit hex value.")
  .transform((value) => normalizeBrandColor(value) ?? value);

export const optionalBrandColorSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null) {
      return null;
    }

    const trimmed = String(value).trim();
    return trimmed.length === 0 ? null : trimmed;
  })
  .pipe(z.union([z.null(), brandColorSchema]));

export const optionalBrandDisplayNameSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null) {
      return null;
    }

    const trimmed = String(value).trim();
    return trimmed.length === 0 ? null : trimmed;
  })
  .pipe(z.union([z.null(), nonEmptyStringSchema.max(120)]));

export const organizationBrandingFieldsSchema = z.object({
  displayName: optionalBrandDisplayNameSchema,
  primaryColor: optionalBrandColorSchema,
  secondaryColor: optionalBrandColorSchema,
  accentColor: optionalBrandColorSchema,
});

export type OrganizationBrandingFields = z.infer<
  typeof organizationBrandingFieldsSchema
>;
