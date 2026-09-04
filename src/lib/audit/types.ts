export const AUDIT_ACTIONS = {
  ORGANIZATION_CREATED: "organization.created",
  ORGANIZATION_UPDATED: "organization.updated",
  ORGANIZATION_SUSPENDED: "organization.suspended",
  ORGANIZATION_ACTIVATED: "organization.activated",
  ORGANIZATION_OWNER_INVITED: "organization.owner_invited",
  ORGANIZATION_USER_INVITED: "organization.user_invited",
  ORGANIZATION_USER_ROLE_CHANGED: "organization.user_role_changed",
  ORGANIZATION_USER_SUSPENDED: "organization.user_suspended",
  ORGANIZATION_USER_REACTIVATED: "organization.user_reactivated",
  ORGANIZATION_OWNERSHIP_TRANSFERRED: "organization.ownership_transferred",
  USER_INVITED: "user.invited",
  USER_SUSPENDED: "user.suspended",
  SUPPORT_SESSION_STARTED: "support_session.started",
  SUPPORT_SESSION_ENDED: "support_session.ended",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
