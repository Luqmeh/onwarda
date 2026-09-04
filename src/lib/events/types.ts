export const DOMAIN_EVENT_TYPES = {
  ORGANIZATION_CREATED: "organization_created",
  ORGANIZATION_BRANDING_UPDATED: "organization.branding_updated",
  ORGANIZATION_BRANDING_LOGO_UPLOADED: "organization.branding_logo_uploaded",
  ORGANIZATION_BRANDING_LOGO_REMOVED: "organization.branding_logo_removed",
  USER_INVITED: "user_invited",
  PROPERTY_CREATED: "property.created",
  PROPERTY_UPDATED: "property.updated",
  RESERVATION_CREATED: "reservation.created",
  RESERVATION_UPDATED: "reservation.updated",
  RESERVATION_STATUS_CHANGED: "reservation.status_changed",
  GUEST_CREATED: "guest.created",
  GUEST_UPDATED: "guest.updated",
  GUEST_PORTAL_CREATED: "guest_portal_created",
  GUEST_PORTAL_OPENED: "guest_portal_opened",
  CHECKIN_COMPLETED: "checkin_completed",
  WIFI_VIEWED: "wifi_viewed",
  ACCESS_VIEWED: "access_viewed",
  SUPPORT_REQUESTED: "support_requested",
  CHECKOUT_COMPLETED: "checkout_completed",
} as const;

export type DomainEventType =
  (typeof DOMAIN_EVENT_TYPES)[keyof typeof DOMAIN_EVENT_TYPES];
