import type { OrganizationUserRole } from "@/types/enums";

export const ORGANIZATION_ADMIN_ROLES: OrganizationUserRole[] = [
  "owner",
  "admin",
];

export const ORGANIZATION_OPERATIONAL_ROLES: OrganizationUserRole[] = [
  "owner",
  "admin",
  "manager",
];

export const ORGANIZATION_ISSUE_WRITE_ROLES: OrganizationUserRole[] = [
  "owner",
  "admin",
  "manager",
  "staff",
];
