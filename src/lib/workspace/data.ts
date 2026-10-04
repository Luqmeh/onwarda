import "server-only";

import { resolveValidSupportWorkspace } from "@/lib/authorization/support-workspace";
import { AppError, AuthorizationError, NotFoundError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/database/server";
import { createPropertyMediaSignedUrl } from "@/lib/property-cms/signed-url";
import { requireCurrentOrganization } from "@/lib/tenancy/context";
import { uuidSchema } from "@/lib/validation/common";
import type { Organization } from "@/types/database";

function metricCount(count: number | null | undefined) {
  return typeof count === "number" && count >= 0 ? count : 0;
}

type EmbeddedRecord<T> = T | T[] | null;

function firstEmbed<T>(value: EmbeddedRecord<T>) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function fail(code: string, message: string): never {
  throw new AppError(code, message, 500);
}

async function requireWorkspaceTenant(): Promise<Organization> {
  try {
    const { organization } = await requireCurrentOrganization();
    return organization;
  } catch (error) {
    if (!(error instanceof AuthorizationError)) {
      throw error;
    }

    const support = await resolveValidSupportWorkspace();

    if (support) {
      return support.organization;
    }

    throw error;
  }
}

export type WorkspaceDashboard = {
  organizationId: string;
  organizationName: string;
  counts: {
    properties: number;
    upcomingReservations: number;
    guests: number;
    openIssues: number;
  };
  guests: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    stayCount: number;
  }>;
  properties: Array<{
    id: string;
    name: string;
    status: string;
    city: string | null;
    country: string | null;
  }>;
  upcomingReservations: Array<{
    id: string;
    checkIn: string;
    checkOut: string;
    status: string;
    propertyName: string | null;
    guestName: { first_name: string; last_name: string } | null;
  }>;
  openIssues: Array<{
    id: string;
    category: string;
    description: string;
    status: string;
    priority: string;
    createdAt: string;
    propertyName: string | null;
  }>;
  activity: Array<{
    id: string;
    eventType: string;
    createdAt: string;
  }>;
};

export async function getWorkspaceDashboard(): Promise<WorkspaceDashboard> {
  const organization = await requireWorkspaceTenant();
  const organizationId = organization.id;
  const supabase = await createSupabaseServerClient();
  const today = new Date().toISOString().slice(0, 10);

  const [
    propertyCount,
    upcomingCount,
    guestCount,
    issueCount,
    properties,
    upcomingReservations,
    guests,
    openIssues,
    activity,
    branding,
  ] = await Promise.all([
    supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId),
    supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("status", ["upcoming", "active"])
      .gte("check_in", today),
    supabase
      .from("guests")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId),
    supabase
      .from("issues")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("status", ["open", "in_progress"]),
    supabase
      .from("properties")
      .select("id, name, status, city, country")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("reservations")
      .select("id, check_in, check_out, status, properties(name), guests(first_name, last_name)")
      .eq("organization_id", organizationId)
      .in("status", ["upcoming", "active"])
      .gte("check_in", today)
      .order("check_in", { ascending: true })
      .limit(5),
    supabase
      .from("guests")
      .select("id, first_name, last_name, email, reservations(count)")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("issues")
      .select("id, category, description, status, priority, created_at, properties(name)")
      .eq("organization_id", organizationId)
      .in("status", ["open", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("events")
      .select("id, event_type, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("organization_branding")
      .select("display_name")
      .eq("organization_id", organizationId)
      .maybeSingle(),
  ]);

  if (
    propertyCount.error ||
    upcomingCount.error ||
    guestCount.error ||
    issueCount.error ||
    properties.error ||
    upcomingReservations.error ||
    guests.error ||
    openIssues.error ||
    activity.error ||
    branding.error
  ) {
    fail("workspace_dashboard_unavailable", "Unable to load the workspace overview.");
  }

  return {
    organizationId,
    organizationName: branding.data?.display_name?.trim() || organization.name,
    counts: {
      properties: metricCount(propertyCount.count),
      upcomingReservations: metricCount(upcomingCount.count),
      guests: metricCount(guestCount.count),
      openIssues: metricCount(issueCount.count),
    },
    properties: (properties.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      city: row.city,
      country: row.country,
    })),
    upcomingReservations: (upcomingReservations.data ?? []).map((row) => {
      const property = firstEmbed(row.properties);
      const guest = firstEmbed(row.guests);

      return {
        id: row.id,
        checkIn: row.check_in,
        checkOut: row.check_out,
        status: row.status,
        propertyName: property?.name ?? null,
        guestName: guest,
      };
    }),
    guests: (guests.data ?? []).map((row) => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      stayCount: metricCount(row.reservations?.[0]?.count),
    })),
    openIssues: (openIssues.data ?? []).map((row) => ({
      id: row.id,
      category: row.category,
      description: row.description,
      status: row.status,
      priority: row.priority,
      createdAt: row.created_at,
      propertyName: firstEmbed(row.properties)?.name ?? null,
    })),
    activity: (activity.data ?? []).map((row) => ({
      id: row.id,
      eventType: row.event_type,
      createdAt: row.created_at,
    })),
  };
}

export async function listWorkspaceProperties() {
  const organization = await requireWorkspaceTenant();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("properties")
    .select("id, name, status, operational_readiness, city, country, property_type, reservations(count)")
    .eq("organization_id", organization.id)
    .order("name", { ascending: true });

  if (error) {
    fail("workspace_properties_unavailable", "Unable to load properties.");
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status,
    readiness: row.operational_readiness,
    city: row.city,
    country: row.country,
    propertyType: row.property_type,
    reservationCount: metricCount(row.reservations?.[0]?.count),
  }));
}

export async function listWorkspaceReservations() {
  const organization = await requireWorkspaceTenant();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("reservations")
    .select(
      "id, check_in, check_out, status, reservation_reference, properties(name), guests(first_name, last_name)",
    )
    .eq("organization_id", organization.id)
    .order("check_in", { ascending: false })
    .limit(50);

  if (error) {
    fail("workspace_reservations_unavailable", "Unable to load reservations.");
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    checkIn: row.check_in,
    checkOut: row.check_out,
    status: row.status,
    reference: row.reservation_reference,
    propertyName: firstEmbed(row.properties)?.name ?? null,
    guestName: firstEmbed(row.guests),
  }));
}

export async function listWorkspaceGuests() {
  const organization = await requireWorkspaceTenant();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("guests")
    .select(
      "id, first_name, last_name, email, reservations(check_in, check_out, status, created_at)",
    )
    .eq("organization_id", organization.id)
    .order("last_name", { ascending: true })
    .limit(50);

  if (error) {
    fail("workspace_guests_unavailable", "Unable to load guests.");
  }

  return (data ?? []).map((row) => {
    const stays = [...(row.reservations ?? [])].sort((left, right) =>
      right.check_in.localeCompare(left.check_in),
    );
    const latest = stays[0] ?? null;

    return {
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      stayCount: stays.length,
      latestReservation: latest
        ? {
            checkIn: latest.check_in,
            checkOut: latest.check_out,
            status: latest.status,
          }
        : null,
    };
  });
}

export async function listWorkspaceIssues() {
  const organization = await requireWorkspaceTenant();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("issues")
    .select("id, category, description, status, priority, created_at, properties(name)")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    fail("workspace_issues_unavailable", "Unable to load issues.");
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    category: row.category,
    description: row.description,
    status: row.status,
    priority: row.priority,
    createdAt: row.created_at,
    propertyName: firstEmbed(row.properties)?.name ?? null,
  }));
}

export async function listWorkspaceKnowledge() {
  const organization = await requireWorkspaceTenant();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("property_knowledge")
    .select("id, title, category, status, locale, visibility, properties(name)")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    fail("workspace_knowledge_unavailable", "Unable to load property knowledge.");
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    category: row.category,
    status: row.status,
    locale: row.locale,
    visibility: row.visibility,
    propertyName: firstEmbed(row.properties)?.name ?? null,
  }));
}

export async function listWorkspaceMembers() {
  const organization = await requireWorkspaceTenant();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organization_users")
    .select("id, role, status, created_at, user_id, profiles(full_name, email)")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: true });

  if (error) {
    fail("workspace_members_unavailable", "Unable to load workspace members.");
  }

  return (data ?? []).map((row) => {
    const profile = firstEmbed(row.profiles);

    return {
      id: row.id,
      userId: row.user_id,
      role: row.role,
      status: row.status,
      createdAt: row.created_at,
      fullName: profile?.full_name ?? null,
      email: profile?.email ?? null,
    };
  });
}

function requireTenantUuid(value: string) {
  const parsed = uuidSchema.safeParse(value);

  if (!parsed.success) {
    throw new NotFoundError();
  }

  return parsed.data;
}

function asNumber(value: unknown) {
  if (value == null || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asTime(value: unknown) {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  return value.slice(0, 5);
}

export async function getWorkspaceProperty(propertyId: string) {
  const organization = await requireWorkspaceTenant();
  const id = requireTenantUuid(propertyId);
  const supabase = await createSupabaseServerClient();

  const [
    { data: property, error: propertyError },
    reservations,
    openIssues,
    knowledge,
    languages,
    amenities,
    houseRules,
    content,
    media,
    reservationCount,
    openIssueCount,
    knowledgeCount,
    stayGuests,
  ] = await Promise.all([
    supabase
      .from("properties")
      .select(
        `
        id, name, slug, status, city, country, address, created_at,
        internal_identifier, description, property_type, capacity, bedrooms,
        bathrooms, check_in_time, check_out_time,
        is_listed_publicly, booking_url
      `,
      )
      .eq("id", id)
      .eq("organization_id", organization.id)
      .maybeSingle(),
    supabase
      .from("reservations")
      .select("id, check_in, check_out, status, guests(id, first_name, last_name)")
      .eq("organization_id", organization.id)
      .eq("property_id", id)
      .order("check_in", { ascending: false })
      .limit(8),
    supabase
      .from("issues")
      .select("id, category, description, status, priority, created_at")
      .eq("organization_id", organization.id)
      .eq("property_id", id)
      .in("status", ["open", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("property_knowledge")
      .select("id, title, category, status, locale, body, visibility, sort_order")
      .eq("organization_id", organization.id)
      .eq("property_id", id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false }),
    supabase
      .from("property_languages")
      .select("language_code")
      .eq("organization_id", organization.id)
      .eq("property_id", id),
    supabase
      .from("property_amenities")
      .select("amenity_key, sort_order")
      .eq("organization_id", organization.id)
      .eq("property_id", id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("property_house_rules")
      .select("rule_key, state, details, visibility, sort_order")
      .eq("organization_id", organization.id)
      .eq("property_id", id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("property_content")
      .select("field_key, body, visibility")
      .eq("organization_id", organization.id)
      .eq("property_id", id),
    supabase
      .from("property_media")
      .select(
        "id, media_type, role, storage_path, external_url, sort_order, caption, alt_text, visibility",
      )
      .eq("organization_id", organization.id)
      .eq("property_id", id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("property_id", id),
    supabase
      .from("issues")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("property_id", id)
      .in("status", ["open", "in_progress"]),
    supabase
      .from("property_knowledge")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("property_id", id),
    supabase
      .from("reservations")
      .select("guest_id")
      .eq("organization_id", organization.id)
      .eq("property_id", id),
  ]);

  if (
    propertyError ||
    reservations.error ||
    openIssues.error ||
    knowledge.error ||
    languages.error ||
    amenities.error ||
    houseRules.error ||
    content.error ||
    media.error ||
    reservationCount.error ||
    openIssueCount.error ||
    knowledgeCount.error ||
    stayGuests.error
  ) {
    fail("workspace_property_unavailable", "Unable to load this property.");
  }

  if (!property) {
    throw new NotFoundError("Property not found.");
  }

  const uniqueGuests = new Set(
    (stayGuests.data ?? []).map((row) => row.guest_id).filter(Boolean),
  );

  const mediaRows = media.data ?? [];
  const signedUrls = await Promise.all(
    mediaRows.map(async (row) =>
      row.storage_path ? createPropertyMediaSignedUrl(row.storage_path) : null,
    ),
  );

  return {
    id: property.id,
    organizationId: organization.id,
    name: property.name,
    slug: property.slug,
    status: property.status,
    city: property.city,
    country: property.country,
    address: property.address,
    internalIdentifier: property.internal_identifier,
    description: property.description,
    propertyType: property.property_type,
    capacity: asNumber(property.capacity),
    bedrooms: asNumber(property.bedrooms),
    bathrooms: asNumber(property.bathrooms),
    checkInTime: asTime(property.check_in_time),
    checkOutTime: asTime(property.check_out_time),
    isListedPublicly: Boolean(property.is_listed_publicly),
    bookingUrl: property.booking_url,
    createdAt: property.created_at,
    languages: (languages.data ?? []).map((row) => row.language_code),
    amenities: (amenities.data ?? []).map((row) => row.amenity_key),
    houseRules: (houseRules.data ?? []).map((row) => ({
      ruleKey: row.rule_key,
      state: row.state,
      details: row.details,
      visibility: row.visibility,
      sortOrder: row.sort_order,
    })),
    content: (content.data ?? []).map((row) => ({
      fieldKey: row.field_key,
      body: row.body,
      visibility: row.visibility,
    })),
    media: mediaRows.map((row, index) => ({
      id: row.id,
      mediaType: row.media_type,
      role: row.role,
      storagePath: row.storage_path,
      externalUrl: row.external_url,
      sortOrder: row.sort_order,
      caption: row.caption,
      altText: row.alt_text,
      visibility: row.visibility,
      signedUrl: signedUrls[index] ?? null,
    })),
    reservationCount: metricCount(reservationCount.count),
    stayGuestCount: uniqueGuests.size,
    openIssueCount: metricCount(openIssueCount.count),
    knowledgeCount: metricCount(knowledgeCount.count),
    reservations: (reservations.data ?? []).map((row) => ({
      id: row.id,
      checkIn: row.check_in,
      checkOut: row.check_out,
      status: row.status,
      guestId: firstEmbed(row.guests)?.id ?? null,
      guestName: firstEmbed(row.guests),
    })),
    issues: (openIssues.data ?? []).map((row) => ({
      id: row.id,
      category: row.category,
      description: row.description,
      status: row.status,
      priority: row.priority,
      createdAt: row.created_at,
    })),
    knowledge: (knowledge.data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      status: row.status,
      locale: row.locale,
      body: row.body,
      visibility: row.visibility,
      sortOrder: row.sort_order,
    })),
  };
}

export async function getWorkspaceReservation(reservationId: string) {
  const organization = await requireWorkspaceTenant();
  const id = requireTenantUuid(reservationId);
  const supabase = await createSupabaseServerClient();

  const [{ data: reservation, error }, issues, portalTokens] = await Promise.all([
    supabase
      .from("reservations")
      .select(
        `
        id,
        status,
        check_in,
        check_out,
        created_at,
        reservation_reference,
        booking_source,
        journey_status,
        onboarding_completed_at,
        rules_accepted_at,
        checkout_completed_at,
        property_id,
        guest_id,
        properties(id, name, city, country),
        guests(id, first_name, last_name, email, phone)
      `,
      )
      .eq("id", id)
      .eq("organization_id", organization.id)
      .maybeSingle(),
    supabase
      .from("issues")
      .select("id, category, description, status, priority, created_at")
      .eq("organization_id", organization.id)
      .eq("reservation_id", id)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("guest_portal_tokens")
      .select("id, expires_at, revoked_at, created_at")
      .eq("organization_id", organization.id)
      .eq("reservation_id", id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (error || issues.error || portalTokens.error) {
    fail("workspace_reservation_unavailable", "Unable to load this reservation.");
  }

  if (!reservation) {
    throw new NotFoundError("Reservation not found.");
  }

  const property = firstEmbed(reservation.properties);
  const guest = firstEmbed(reservation.guests);

  return {
    id: reservation.id,
    status: reservation.status,
    checkIn: reservation.check_in,
    checkOut: reservation.check_out,
    createdAt: reservation.created_at,
    reference: reservation.reservation_reference,
    bookingSource: reservation.booking_source,
    journeyStatus: reservation.journey_status,
    onboardingCompletedAt: reservation.onboarding_completed_at,
    rulesAcceptedAt: reservation.rules_accepted_at,
    checkoutCompletedAt: reservation.checkout_completed_at,
    guestPortal: (() => {
      const now = Date.now();
      const tokens = portalTokens.data ?? [];
      const active = tokens.find(
        (row) => !row.revoked_at && (!row.expires_at || new Date(row.expires_at).getTime() > now),
      );

      return {
        hasActiveLink: Boolean(active),
        expiresAt: active?.expires_at ?? null,
        createdAt: active?.created_at ?? tokens[0]?.created_at ?? null,
      };
    })(),
    propertyId: reservation.property_id,
    guestId: reservation.guest_id,
    propertyName: property?.name ?? "Property",
    propertyCity: property?.city ?? null,
    propertyCountry: property?.country ?? null,
    guestFirstName: guest?.first_name ?? null,
    guestLastName: guest?.last_name ?? null,
    guestEmail: guest?.email ?? null,
    guestPhone: guest?.phone ?? null,
    issues: (issues.data ?? []).map((row) => ({
      id: row.id,
      category: row.category,
      description: row.description,
      status: row.status,
      priority: row.priority,
      createdAt: row.created_at,
    })),
  };
}

export async function getWorkspaceGuest(guestId: string) {
  const organization = await requireWorkspaceTenant();
  const id = requireTenantUuid(guestId);
  const supabase = await createSupabaseServerClient();
  const [{ data: guest, error }, reservations] = await Promise.all([
    supabase
      .from("guests")
      .select("id, first_name, last_name, email, phone, created_at")
      .eq("id", id)
      .eq("organization_id", organization.id)
      .maybeSingle(),
    supabase
      .from("reservations")
      .select(
        "id, check_in, check_out, status, property_id, properties(name, city, country)",
      )
      .eq("organization_id", organization.id)
      .eq("guest_id", id)
      .order("check_in", { ascending: false }),
  ]);

  if (error || reservations.error) {
    fail("workspace_guest_unavailable", "Unable to load this guest.");
  }

  if (!guest) {
    throw new NotFoundError("Guest not found.");
  }

  const stays = reservations.data ?? [];

  return {
    id: guest.id,
    firstName: guest.first_name,
    lastName: guest.last_name,
    email: guest.email,
    phone: guest.phone,
    createdAt: guest.created_at,
    reservationCount: stays.length,
    reservations: stays.map((row) => ({
      id: row.id,
      checkIn: row.check_in,
      checkOut: row.check_out,
      status: row.status,
      propertyId: row.property_id,
      propertyName: firstEmbed(row.properties)?.name ?? "Property",
      propertyCity: firstEmbed(row.properties)?.city ?? null,
      propertyCountry: firstEmbed(row.properties)?.country ?? null,
    })),
  };
}

export async function listWorkspaceGuestsForSelect() {
  const organization = await requireWorkspaceTenant();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("guests")
    .select("id, first_name, last_name, email")
    .eq("organization_id", organization.id)
    .order("last_name", { ascending: true })
    .limit(100);

  if (error) {
    fail("workspace_guests_unavailable", "Unable to load guests.");
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
  }));
}
