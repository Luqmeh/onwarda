import { z } from "zod";

import { RESERVED_ORGANIZATION_SLUGS } from "@/config/app";
import {
  BILLING_INTERVALS,
  ONBOARDING_STATUSES,
  ORGANIZATION_PLANS,
  ORGANIZATION_STATUSES,
  ORGANIZATION_SUBSCRIPTION_STATUSES,
  ORGANIZATION_USER_ROLES,
  ORGANIZATION_USER_STATUSES,
  SUBSCRIPTION_STATUSES,
} from "@/types/enums";
import { emailSchema, languageSchema, nonEmptyStringSchema, timezoneSchema, urlSchema } from "@/lib/validation/common";

export const organizationSlugSchema = z
  .string()
  .trim()
  .min(2)
  .max(63)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must be lowercase letters, numbers, and hyphens.",
  )
  .refine(
    (slug) =>
      !RESERVED_ORGANIZATION_SLUGS.includes(
        slug as (typeof RESERVED_ORGANIZATION_SLUGS)[number],
      ),
    "This slug is reserved.",
  );

export const organizationNameSchema = nonEmptyStringSchema.max(120);

export const organizationStatusSchema = z.enum(ORGANIZATION_STATUSES);

export const provisionOrganizationStatusSchema = z.enum([
  ORGANIZATION_STATUSES.ACTIVE,
  ORGANIZATION_STATUSES.PENDING,
  ORGANIZATION_STATUSES.SUSPENDED,
]);

export function suggestOrganizationSlug(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

export function sanitizeOrganizationSearch(value: string) {
  return value.trim().slice(0, 80).replace(/[^a-zA-Z0-9\s-]/g, "");
}

export const provisionOrganizationSchema = z.object({
  name: organizationNameSchema,
  slug: organizationSlugSchema,
  status: provisionOrganizationStatusSchema.default(ORGANIZATION_STATUSES.ACTIVE),
  ownerEmail: emailSchema.transform((value) => value.trim().toLowerCase()),
});

export const organizationStatusMutationSchema = z.object({
  organizationId: z.uuid(),
  status: z.enum([ORGANIZATION_STATUSES.ACTIVE, ORGANIZATION_STATUSES.SUSPENDED]),
  confirm: z.string().optional(),
});

export const organizationMemberRoleSchema = z.enum([
  ORGANIZATION_USER_ROLES.ADMIN,
  ORGANIZATION_USER_ROLES.MANAGER,
  ORGANIZATION_USER_ROLES.STAFF,
]);

export const inviteOrganizationUserSchema = z.object({
  organizationId: z.uuid(),
  email: emailSchema.transform((value) => value.trim().toLowerCase()),
  role: organizationMemberRoleSchema,
});

export const setOrganizationUserRoleSchema = z.object({
  organizationId: z.uuid(),
  userId: z.uuid(),
  role: organizationMemberRoleSchema,
});

export const setOrganizationUserStatusSchema = z.object({
  organizationId: z.uuid(),
  userId: z.uuid(),
  status: z.enum([
    ORGANIZATION_USER_STATUSES.ACTIVE,
    ORGANIZATION_USER_STATUSES.SUSPENDED,
  ]),
});

export const transferOrganizationOwnershipSchema = z.object({
  organizationId: z.uuid(),
  userId: z.uuid(),
  confirm: z.literal("transfer"),
});

export const startSupportSessionSchema = z.object({
  organizationId: z.uuid(),
  reason: z.string().trim().min(3).max(500),
  confirm: z.literal("support"),
});

export const subscriptionStatusSchema = z.enum(SUBSCRIPTION_STATUSES);

export const organizationPlanSchema = z.enum(ORGANIZATION_PLANS);
export const organizationSubscriptionStatusSchema = z.enum(
  ORGANIZATION_SUBSCRIPTION_STATUSES,
);
export const billingIntervalSchema = z.enum(BILLING_INTERVALS);

const optionalTimestampSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

export const setOrganizationSubscriptionSchema = z.object({
  organizationId: z.uuid(),
  plan: organizationPlanSchema,
  status: organizationSubscriptionStatusSchema,
  billingInterval: billingIntervalSchema,
  startedAt: optionalTimestampSchema,
  renewsAt: optionalTimestampSchema,
  cancelledAt: optionalTimestampSchema,
});

export const onboardingStatusSchema = z.enum(ONBOARDING_STATUSES);

export { organizationBrandingFieldsSchema as organizationBrandingSchema } from "@/lib/validation/branding";

export const createOrganizationDraftSchema = z.object({
  name: organizationNameSchema,
  slug: organizationSlugSchema,
  legalName: z.string().trim().max(160).optional(),
  website: urlSchema.optional(),
  phone: z.string().trim().max(40).optional(),
  country: z.string().trim().max(80).optional(),
  timezone: timezoneSchema.optional(),
  defaultLanguage: languageSchema.default("en"),
  status: organizationStatusSchema.default("pending"),
  ownerEmail: emailSchema.optional(),
});
