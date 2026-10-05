import { z } from "zod";

import { PROPERTY_AMENITIES, PROPERTY_CONTENT_LANGUAGES } from "@/lib/property-cms/catalog";
import { PROPERTY_TYPES } from "@/types/enums";
import { emailSchema, nonEmptyStringSchema } from "@/lib/validation/common";

export const onboardingPasswordSchema = z
  .object({
    password: z.string().min(8).max(128),
    confirmPassword: z.string().min(8).max(128),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const onboardingBusinessSchema = z.object({
  name: nonEmptyStringSchema.max(120),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  country: z.string().trim().max(80).optional().or(z.literal("")),
  defaultLanguage: z.enum(["en", "fr", "ar"]),
});

export const onboardingPropertySchema = z.object({
  name: nonEmptyStringSchema.max(120),
  propertyType: z.enum(PROPERTY_TYPES).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  country: z.string().trim().max(80).optional().or(z.literal("")),
});

export const onboardingPropertyDetailsSchema = z.object({
  propertyId: z.uuid(),
  amenities: z.array(z.enum(PROPERTY_AMENITIES)).default([]),
  quietHours: z.enum(["unspecified", "not_allowed", "limited"]).default("unspecified"),
  smoking: z.enum(["unspecified", "not_allowed", "allowed"]).default("unspecified"),
  pets: z.enum(["unspecified", "not_allowed", "allowed"]).default("unspecified"),
  arrival: z.string().trim().max(4000).optional().or(z.literal("")),
  wifi: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const onboardingGuideSchema = z.object({
  propertyId: z.uuid(),
  title: nonEmptyStringSchema.max(140),
  body: nonEmptyStringSchema.max(8000),
  category: z.enum(["tutorial", "washer", "tv", "check_in", "faq", "ac"]).default("tutorial"),
});

export const onboardingCleanerSchema = z.object({
  displayName: nonEmptyStringSchema.min(2).max(80),
  propertyId: z.uuid().optional().or(z.literal("")),
});

export const onboardingReservationSchema = z.object({
  propertyId: z.uuid(),
  firstName: nonEmptyStringSchema.max(80),
  lastName: nonEmptyStringSchema.max(80),
  email: z.union([z.literal(""), emailSchema]).optional(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const onboardingLanguageSchema = z.enum(PROPERTY_CONTENT_LANGUAGES);
