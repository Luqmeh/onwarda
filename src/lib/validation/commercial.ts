import { z } from "zod";

import { isSelectableCommercialPlan } from "@/config/pricing";
import { emailSchema, nonEmptyStringSchema } from "@/lib/validation/common";
import { organizationNameSchema } from "@/lib/validation/organization";

function optionalTrimmed(max: number) {
  return z.preprocess((value) => {
    if (value == null) {
      return undefined;
    }

    const trimmed = String(value).trim();
    return trimmed.length === 0 ? undefined : trimmed;
  }, z.string().max(max).optional());
}

export const commercialPlanIdSchema = z
  .string()
  .trim()
  .refine((value) => isSelectableCommercialPlan(value), "Unknown plan.");

export const signupPasswordSchema = z.string().min(8).max(128);

export const commercialSignupSchema = z.object({
  email: emailSchema,
  password: signupPasswordSchema,
  fullName: nonEmptyStringSchema.max(120),
  organizationName: organizationNameSchema,
  phone: optionalTrimmed(40),
  plan: commercialPlanIdSchema,
});

export const commercialOnboardingSchema = z.object({
  organizationName: organizationNameSchema,
  phone: optionalTrimmed(40),
  plan: commercialPlanIdSchema,
});

export const commercialInquirySchema = z.object({
  kind: z.enum(["contact", "demo"]),
  name: nonEmptyStringSchema.max(120),
  email: emailSchema,
  companyName: optionalTrimmed(160),
  propertyCount: optionalTrimmed(40),
  message: nonEmptyStringSchema.max(4000),
  plan: z.preprocess((value) => {
    if (value == null) {
      return undefined;
    }

    const trimmed = String(value).trim();
    return trimmed.length === 0 ? undefined : trimmed;
  }, commercialPlanIdSchema.optional()),
});
