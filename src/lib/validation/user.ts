import { z } from "zod";

import { ORGANIZATION_USER_ROLES } from "@/types/enums";
import { emailSchema, nonEmptyStringSchema } from "@/lib/validation/common";

export const organizationUserRoleSchema = z.enum(ORGANIZATION_USER_ROLES);

export const userInviteSchema = z.object({
  email: emailSchema,
  fullName: nonEmptyStringSchema.max(120).optional(),
  role: organizationUserRoleSchema.default("owner"),
});
