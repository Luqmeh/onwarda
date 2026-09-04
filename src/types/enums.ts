export const APP_CONTEXTS = {
  ADMIN: "admin",
  CLIENT: "client",
  GUEST: "guest",
} as const;

export type AppContext = (typeof APP_CONTEXTS)[keyof typeof APP_CONTEXTS];

export const PLATFORM_ADMIN_ROLES = {
  SUPER_ADMIN: "super_admin",
} as const;

export type PlatformAdminRole =
  (typeof PLATFORM_ADMIN_ROLES)[keyof typeof PLATFORM_ADMIN_ROLES];

export const PLATFORM_ADMIN_STATUSES = {
  ACTIVE: "active",
  SUSPENDED: "suspended",
} as const;

export type PlatformAdminStatus =
  (typeof PLATFORM_ADMIN_STATUSES)[keyof typeof PLATFORM_ADMIN_STATUSES];

export const ORGANIZATION_USER_ROLES = {
  OWNER: "owner",
  ADMIN: "admin",
  MANAGER: "manager",
  STAFF: "staff",
} as const;

export type OrganizationUserRole =
  (typeof ORGANIZATION_USER_ROLES)[keyof typeof ORGANIZATION_USER_ROLES];

export const ORGANIZATION_USER_STATUSES = {
  ACTIVE: "active",
  INVITED: "invited",
  SUSPENDED: "suspended",
} as const;

export type OrganizationUserStatus =
  (typeof ORGANIZATION_USER_STATUSES)[keyof typeof ORGANIZATION_USER_STATUSES];

export const ORGANIZATION_STATUSES = {
  ACTIVE: "active",
  SUSPENDED: "suspended",
  PENDING: "pending",
  ARCHIVED: "archived",
} as const;

export type OrganizationStatus =
  (typeof ORGANIZATION_STATUSES)[keyof typeof ORGANIZATION_STATUSES];

export const SUBSCRIPTION_STATUSES = {
  NONE: "none",
  TRIAL: "trial",
  ACTIVE: "active",
  PAST_DUE: "past_due",
  CANCELLED: "cancelled",
} as const;

export type SubscriptionStatus =
  (typeof SUBSCRIPTION_STATUSES)[keyof typeof SUBSCRIPTION_STATUSES];

export const ORGANIZATION_PLANS = {
  FREE: "free",
  STARTER: "starter",
  PROFESSIONAL: "professional",
  ENTERPRISE: "enterprise",
} as const;

export type OrganizationPlan =
  (typeof ORGANIZATION_PLANS)[keyof typeof ORGANIZATION_PLANS];

export const ORGANIZATION_SUBSCRIPTION_STATUSES = {
  TRIALING: "trialing",
  ACTIVE: "active",
  PAST_DUE: "past_due",
  CANCELLED: "cancelled",
  PAUSED: "paused",
} as const;

export type OrganizationSubscriptionStatus =
  (typeof ORGANIZATION_SUBSCRIPTION_STATUSES)[keyof typeof ORGANIZATION_SUBSCRIPTION_STATUSES];

export const BILLING_INTERVALS = {
  MONTH: "month",
  YEAR: "year",
} as const;

export type BillingInterval =
  (typeof BILLING_INTERVALS)[keyof typeof BILLING_INTERVALS];

export const ONBOARDING_STATUSES = {
  NOT_STARTED: "not_started",
  IN_PROGRESS: "in_progress",
  COMPLETE: "complete",
  NEEDS_ATTENTION: "needs_attention",
} as const;

export type OnboardingStatus =
  (typeof ONBOARDING_STATUSES)[keyof typeof ONBOARDING_STATUSES];

export const PROPERTY_STATUSES = {
  DRAFT: "draft",
  ACTIVE: "active",
  INACTIVE: "inactive",
  ARCHIVED: "archived",
} as const;

export type PropertyStatus =
  (typeof PROPERTY_STATUSES)[keyof typeof PROPERTY_STATUSES];

export const RESERVATION_STATUSES = {
  UPCOMING: "upcoming",
  ACTIVE: "active",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export type ReservationStatus =
  (typeof RESERVATION_STATUSES)[keyof typeof RESERVATION_STATUSES];

export const BOOKING_SOURCES = {
  AIRBNB: "airbnb",
  BOOKING_COM: "booking_com",
  DIRECT: "direct",
  OTHER: "other",
} as const;

export type BookingSource =
  (typeof BOOKING_SOURCES)[keyof typeof BOOKING_SOURCES];

export const ISSUE_CATEGORIES = {
  ACCESS_PROBLEM: "access_problem",
  WIFI: "wifi",
  HOT_WATER: "hot_water",
  AIR_CONDITIONING: "air_conditioning",
  CLEANING: "cleaning",
  SOMETHING_BROKEN: "something_broken",
  OTHER: "other",
} as const;

export type IssueCategory =
  (typeof ISSUE_CATEGORIES)[keyof typeof ISSUE_CATEGORIES];

export const ISSUE_PRIORITIES = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  URGENT: "urgent",
} as const;

export type IssuePriority =
  (typeof ISSUE_PRIORITIES)[keyof typeof ISSUE_PRIORITIES];

export const ISSUE_STATUSES = {
  OPEN: "open",
  IN_PROGRESS: "in_progress",
  RESOLVED: "resolved",
} as const;

export const PROPERTY_KNOWLEDGE_CATEGORIES = {
  HOUSE_RULES: "house_rules",
  CHECK_IN: "check_in",
  CHECK_OUT: "check_out",
  WIFI: "wifi",
  ACCESS: "access",
  FAQ: "faq",
  TUTORIAL: "tutorial",
  OTHER: "other",
} as const;

export type PropertyKnowledgeCategory =
  (typeof PROPERTY_KNOWLEDGE_CATEGORIES)[keyof typeof PROPERTY_KNOWLEDGE_CATEGORIES];

export type IssueStatus = (typeof ISSUE_STATUSES)[keyof typeof ISSUE_STATUSES];

export const ACTOR_TYPES = {
  PLATFORM_ADMIN: "platform_admin",
  ORGANIZATION_USER: "organization_user",
  GUEST: "guest",
  SYSTEM: "system",
} as const;

export type ActorType = (typeof ACTOR_TYPES)[keyof typeof ACTOR_TYPES];

export const SUPPORTED_LOCALES = {
  ENGLISH: "en",
  FRENCH: "fr",
  ARABIC: "ar",
} as const;

export type SupportedLocale =
  (typeof SUPPORTED_LOCALES)[keyof typeof SUPPORTED_LOCALES];
