import { z } from "zod";

import { commercialPlanIdSchema } from "@/lib/validation/commercial";

export const customerPlanChangeSchema = z.object({
  plan: commercialPlanIdSchema,
});

export const customerBillingActionSchema = z.object({
  confirm: z.string().optional(),
});
