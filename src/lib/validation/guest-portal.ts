import { z } from "zod";

import { ISSUE_CATEGORIES } from "@/types/enums";
import { emailSchema, nonEmptyStringSchema } from "@/lib/validation/common";

const emptyToUndefined = z
  .union([z.string(), z.undefined(), z.null()])
  .transform((value) => {
    const trimmed = String(value ?? "").trim();
    return trimmed.length === 0 ? undefined : trimmed;
  });

export const guestOnboardingSchema = z.object({
  firstName: nonEmptyStringSchema.max(80),
  lastName: nonEmptyStringSchema.max(80),
  email: emptyToUndefined.pipe(z.union([z.undefined(), emailSchema])),
  phone: emptyToUndefined.pipe(z.union([z.undefined(), z.string().trim().max(40)])),
  numberOfGuests: z.coerce.number().int().min(1).max(50),
  arrivalNotes: emptyToUndefined.pipe(z.union([z.undefined(), z.string().trim().max(2000)])),
});

export const guestArrivalNotesSchema = z.object({
  arrivalNotes: nonEmptyStringSchema.max(2000),
});

export const guestIssueSchema = z.object({
  category: z.enum(ISSUE_CATEGORIES),
  description: nonEmptyStringSchema.max(2000),
});

export const publicSlugSchema = z
  .string()
  .trim()
  .min(2)
  .max(63)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
