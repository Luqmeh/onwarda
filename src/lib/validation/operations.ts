import { z } from "zod";

import {
  BOOKING_SOURCES,
  ISSUE_CATEGORIES,
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  PROPERTY_STATUSES,
  RESERVATION_STATUSES,
} from "@/types/enums";
import { dateSchema, emailSchema, nonEmptyStringSchema, uuidSchema } from "@/lib/validation/common";

export {
  createWorkspaceKnowledgeSchema,
  createWorkspacePropertySchema,
  updateWorkspacePropertySchema,
} from "@/lib/validation/property-cms";

export const propertyDraftSchema = z.object({
  name: nonEmptyStringSchema.max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(63)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  status: z.enum(PROPERTY_STATUSES).default("draft"),
});

const optionalGuestEmailSchema = z
  .union([z.string(), z.undefined(), z.null()])
  .transform((value) => {
    const trimmed = String(value ?? "").trim();
    return trimmed.length === 0 ? undefined : trimmed.toLowerCase();
  })
  .pipe(z.union([z.undefined(), emailSchema]));

const optionalGuestPhoneSchema = z
  .union([z.string(), z.undefined(), z.null()])
  .transform((value) => {
    const trimmed = String(value ?? "").trim();
    return trimmed.length === 0 ? undefined : trimmed;
  })
  .pipe(z.union([z.undefined(), z.string().max(40)]));

export const createWorkspaceGuestSchema = z.object({
  firstName: nonEmptyStringSchema.max(80),
  lastName: nonEmptyStringSchema.max(80),
  email: optionalGuestEmailSchema,
  phone: optionalGuestPhoneSchema,
});

export const updateWorkspaceGuestSchema = createWorkspaceGuestSchema;

export const createWorkspaceReservationSchema = z
  .object({
    propertyId: uuidSchema,
    guestMode: z.enum(["existing", "new"]),
    guestId: z.union([uuidSchema, z.literal(""), z.undefined()]).optional(),
    firstName: z.string().trim().max(80).optional(),
    lastName: z.string().trim().max(80).optional(),
    email: optionalGuestEmailSchema.optional(),
    phone: optionalGuestPhoneSchema.optional(),
    checkIn: dateSchema,
    checkOut: dateSchema,
    status: z
      .enum([
        RESERVATION_STATUSES.UPCOMING,
        RESERVATION_STATUSES.ACTIVE,
        RESERVATION_STATUSES.COMPLETED,
        RESERVATION_STATUSES.CANCELLED,
      ])
      .default(RESERVATION_STATUSES.UPCOMING),
  })
  .superRefine((value, context) => {
    if (value.checkOut <= value.checkIn) {
      context.addIssue({
        code: "custom",
        path: ["checkOut"],
        message: "Departure must be after arrival.",
      });
    }

    if (value.guestMode === "existing" && !value.guestId) {
      context.addIssue({
        code: "custom",
        path: ["guestId"],
        message: "Choose an existing guest.",
      });
    }

    if (value.guestMode === "new") {
      if (!value.firstName?.trim()) {
        context.addIssue({
          code: "custom",
          path: ["firstName"],
          message: "Enter the guest first name.",
        });
      }

      if (!value.lastName?.trim()) {
        context.addIssue({
          code: "custom",
          path: ["lastName"],
          message: "Enter the guest last name.",
        });
      }
    }
  });

export const updateWorkspaceReservationStatusSchema = z.object({
  status: z.enum(RESERVATION_STATUSES),
});

export const updateWorkspaceIssueStatusSchema = z.object({
  issueId: uuidSchema,
  status: z.enum(ISSUE_STATUSES),
});

export const guestDraftSchema = z.object({
  firstName: nonEmptyStringSchema.max(80),
  lastName: nonEmptyStringSchema.max(80),
  email: emailSchema.optional(),
  phone: z.string().trim().max(40).optional(),
  nationality: z.string().trim().max(80).optional(),
});

export const reservationDraftSchema = z
  .object({
    propertyId: uuidSchema,
    guestId: uuidSchema,
    reservationReference: nonEmptyStringSchema.max(80),
    bookingSource: z.enum(BOOKING_SOURCES),
    checkIn: dateSchema,
    checkOut: dateSchema,
    numberOfGuests: z.number().int().min(1).max(100),
    status: z.enum(RESERVATION_STATUSES).default("upcoming"),
  })
  .refine((value) => value.checkOut > value.checkIn, {
    message: "Check-out must be after check-in.",
    path: ["checkOut"],
  });

export const issueDraftSchema = z.object({
  category: z.enum(ISSUE_CATEGORIES),
  description: nonEmptyStringSchema.max(2000),
  priority: z.enum(ISSUE_PRIORITIES).default("medium"),
  status: z.enum(ISSUE_STATUSES).default("open"),
  propertyId: uuidSchema.optional(),
  reservationId: uuidSchema.optional(),
  guestId: uuidSchema.optional(),
});
