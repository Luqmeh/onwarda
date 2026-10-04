import { z } from "zod";

export const cleanerTokenSchema = z
  .string()
  .trim()
  .min(32)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/, "Cleaner links must be opaque random values.");

export const cleaningAgentNameSchema = z.string().trim().min(2).max(80);

export const createCleaningAgentSchema = z.object({
  displayName: cleaningAgentNameSchema,
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => (value ? value : undefined)),
});

export const assignCleaningAgentSchema = z.object({
  propertyId: z.uuid(),
  cleaningAgentId: z.uuid(),
});

export const cleaningAssigneeSchema = z.union([z.uuid(), z.literal("unassigned")]);

export const createManualCleaningSchema = z.object({
  propertyId: z.uuid(),
  assignee: cleaningAssigneeSchema,
  requestKey: z.uuid(),
  confirmExtra: z.boolean(),
});

export const assignCleaningTaskSchema = z.object({
  assignee: cleaningAssigneeSchema,
});
