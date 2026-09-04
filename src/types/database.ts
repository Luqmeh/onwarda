import type {
  ActorType,
  BookingSource,
  IssueCategory,
  IssuePriority,
  IssueStatus,
  OnboardingStatus,
  BillingInterval,
  OrganizationPlan,
  OrganizationStatus,
  OrganizationSubscriptionStatus,
  OrganizationUserRole,
  OrganizationUserStatus,
  PlatformAdminRole,
  PlatformAdminStatus,
  PropertyStatus,
  ReservationStatus,
  SubscriptionStatus,
} from "@/types/enums";

export type Profile = {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type PlatformAdmin = {
  id: string;
  user_id: string;
  role: PlatformAdminRole;
  status: PlatformAdminStatus;
  created_at: string;
  updated_at: string;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  legal_name: string | null;
  status: OrganizationStatus;
  subscription_status: SubscriptionStatus;
  onboarding_status: OnboardingStatus;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  website: string | null;
  phone: string | null;
  country: string | null;
  timezone: string | null;
  default_language: "en" | "fr" | "ar";
  created_at: string;
  updated_at: string;
};

export type OrganizationBrandingRecord = {
  id: string;
  organization_id: string;
  display_name: string | null;
  logo_path: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  created_at: string;
  updated_at: string;
};

export type OrganizationUser = {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrganizationUserRole;
  status: OrganizationUserStatus;
  created_at: string;
  updated_at: string;
};

export type Property = {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  internal_identifier: string | null;
  description: string | null;
  property_type: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  capacity: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  check_in_time: string | null;
  check_out_time: string | null;
  timezone: string | null;
  status: PropertyStatus;
  created_at: string;
  updated_at: string;
};

export type Guest = {
  id: string;
  organization_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  created_at: string;
  updated_at: string;
};

export type Reservation = {
  id: string;
  organization_id: string;
  property_id: string;
  guest_id: string;
  reservation_reference: string;
  booking_source: BookingSource;
  check_in: string;
  check_out: string;
  number_of_guests: number;
  notes: string | null;
  status: ReservationStatus;
  created_at: string;
  updated_at: string;
};

export type GuestPortalToken = {
  id: string;
  organization_id: string;
  reservation_id: string;
  property_id: string;
  token_hash: string;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PropertyKnowledge = {
  id: string;
  organization_id: string;
  property_id: string;
  category: string;
  title: string | null;
  body: string;
  locale: "en" | "fr" | "ar";
  status: "draft" | "published" | "archived";
  created_at: string;
  updated_at: string;
};

export type Issue = {
  id: string;
  organization_id: string;
  property_id: string | null;
  reservation_id: string | null;
  guest_id: string | null;
  category: IssueCategory;
  description: string;
  priority: IssuePriority;
  status: IssueStatus;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

export type DomainEvent = {
  id: string;
  organization_id: string | null;
  property_id: string | null;
  reservation_id: string | null;
  guest_id: string | null;
  actor_user_id: string | null;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AuditLog = {
  id: string;
  actor_user_id: string | null;
  actor_type: ActorType;
  action: string;
  target_type: string;
  target_id: string | null;
  organization_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

export type OrganizationSubscription = {
  id: string;
  organization_id: string;
  plan: OrganizationPlan;
  status: OrganizationSubscriptionStatus;
  billing_interval: BillingInterval;
  started_at: string;
  renews_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SupportSession = {
  id: string;
  organization_id: string;
  platform_admin_user_id: string;
  reason: string | null;
  metadata: Record<string, unknown>;
  started_at: string;
  expires_at: string;
  ended_at: string | null;
  created_at: string;
};
