"use server";

import { redirect } from "next/navigation";

import { CLIENT_ROUTES, clientPropertyPath, clientReservationPath } from "@/config/client";
import {
  ORGANIZATION_ADMIN_ROLES,
  ORGANIZATION_ISSUE_WRITE_ROLES,
  ORGANIZATION_OPERATIONAL_ROLES,
} from "@/lib/authorization/roles";
import { createSupabaseServerClient } from "@/lib/database/server";
import {
  AuthenticationError,
  AuthorizationError,
  TenantIsolationError,
  ValidationError,
} from "@/lib/errors";
import { requireOrganizationRole } from "@/lib/tenancy/context";
import { suggestOrganizationSlug } from "@/lib/validation/organization";
import { uuidSchema } from "@/lib/validation/common";
import {
  createWorkspaceGuestSchema,
  createWorkspaceKnowledgeSchema,
  createWorkspacePropertySchema,
  createWorkspaceReservationSchema,
  updateWorkspaceGuestSchema,
  updateWorkspaceIssueStatusSchema,
  updateWorkspacePropertySchema,
  updateWorkspaceReservationStatusSchema,
} from "@/lib/validation/operations";

export type WorkspaceMutationState = {
  error?: string;
};

function publicMutationError(error: unknown) {
  if (
    error instanceof ValidationError ||
    error instanceof AuthorizationError ||
    error instanceof TenantIsolationError
  ) {
    return error.message;
  }

  return "This action could not be completed.";
}

async function uniquePropertySlug(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organizationId: string,
  name: string,
) {
  const base = suggestOrganizationSlug(name) || "property";
  let slug = base;
  let attempt = 1;

  while (attempt < 20) {
    const { data } = await supabase
      .from("properties")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("slug", slug)
      .maybeSingle();

    if (!data) {
      return slug;
    }

    attempt += 1;
    slug = `${base}-${attempt}`;
  }

  return `${base}-${Date.now().toString(36)}`;
}

export async function createWorkspacePropertyAction(
  _previous: WorkspaceMutationState,
  formData: FormData,
): Promise<WorkspaceMutationState> {
  let createdPropertyId = "";

  try {
    const context = await requireOrganizationRole(ORGANIZATION_ADMIN_ROLES);
    const parsed = createWorkspacePropertySchema.safeParse({
      name: formData.get("name"),
      city: String(formData.get("city") ?? "").trim() || undefined,
      country: String(formData.get("country") ?? "").trim() || undefined,
      status: formData.get("status") || "draft",
    });

    if (!parsed.success) {
      return { error: "Enter a property name, location, and status." };
    }

    const supabase = await createSupabaseServerClient();
    const organizationId = context.organization.id;
    const slug = await uniquePropertySlug(supabase, organizationId, parsed.data.name);
    const { data, error } = await supabase
      .from("properties")
      .insert({
        organization_id: organizationId,
        name: parsed.data.name,
        slug,
        city: parsed.data.city ?? null,
        country: parsed.data.country ?? null,
        status: parsed.data.status,
      })
      .select("id")
      .maybeSingle();

    if (error || !data) {
      return { error: "Unable to create this property." };
    }

    await supabase.from("events").insert({
      organization_id: organizationId,
      property_id: data.id,
      actor_user_id: context.user.id,
      event_type: "property.created",
      metadata: { name: parsed.data.name },
    });

    createdPropertyId = data.id;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    return { error: publicMutationError(error) };
  }

  redirect(clientPropertyPath(createdPropertyId));
}

export async function updateWorkspacePropertyAction(
  propertyId: string,
  _previous: WorkspaceMutationState,
  formData: FormData,
): Promise<WorkspaceMutationState> {
  try {
    const context = await requireOrganizationRole(ORGANIZATION_ADMIN_ROLES);
    const parsedId = uuidSchema.safeParse(propertyId);
    const parsed = updateWorkspacePropertySchema.safeParse({
      name: formData.get("name"),
      city: String(formData.get("city") ?? "").trim() || undefined,
      country: String(formData.get("country") ?? "").trim() || undefined,
      status: formData.get("status") || "draft",
    });

    if (!parsedId.success || !parsed.success) {
      return { error: "Enter a property name, location, and status." };
    }

    const supabase = await createSupabaseServerClient();
    const { data: property, error: lookupError } = await supabase
      .from("properties")
      .select("id")
      .eq("id", parsedId.data)
      .eq("organization_id", context.organization.id)
      .maybeSingle();

    if (lookupError || !property) {
      return { error: "That property is not available in this workspace." };
    }

    const { error } = await supabase
      .from("properties")
      .update({
        name: parsed.data.name,
        city: parsed.data.city ?? null,
        country: parsed.data.country ?? null,
        status: parsed.data.status,
      })
      .eq("id", property.id)
      .eq("organization_id", context.organization.id);

    if (error) {
      return { error: "Unable to update this property." };
    }

    await supabase.from("events").insert({
      organization_id: context.organization.id,
      property_id: property.id,
      actor_user_id: context.user.id,
      event_type: "property.updated",
      metadata: { name: parsed.data.name, status: parsed.data.status },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    return { error: publicMutationError(error) };
  }

  redirect(clientPropertyPath(propertyId));
}

export async function updateWorkspaceIssueStatusAction(
  _previous: WorkspaceMutationState,
  formData: FormData,
): Promise<WorkspaceMutationState> {
  try {
    const context = await requireOrganizationRole(ORGANIZATION_ISSUE_WRITE_ROLES);
    const parsed = updateWorkspaceIssueStatusSchema.safeParse({
      issueId: formData.get("issueId"),
      status: formData.get("status"),
    });

    if (!parsed.success) {
      return { error: "Choose a valid issue status." };
    }

    const supabase = await createSupabaseServerClient();
    const { data: issue, error: issueError } = await supabase
      .from("issues")
      .select("id, organization_id")
      .eq("id", parsed.data.issueId)
      .eq("organization_id", context.organization.id)
      .maybeSingle();

    if (issueError || !issue) {
      return { error: "That issue is not available in this workspace." };
    }

    const { error } = await supabase
      .from("issues")
      .update({
        status: parsed.data.status,
        resolved_at: parsed.data.status === "resolved" ? new Date().toISOString() : null,
      })
      .eq("id", issue.id)
      .eq("organization_id", context.organization.id);

    if (error) {
      return { error: "Unable to update this issue." };
    }

    await supabase.from("events").insert({
      organization_id: context.organization.id,
      actor_user_id: context.user.id,
      event_type: "issue.status_updated",
      metadata: { issueId: issue.id, status: parsed.data.status },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    return { error: publicMutationError(error) };
  }

  redirect(CLIENT_ROUTES.issues);
}

export async function createWorkspaceKnowledgeAction(
  _previous: WorkspaceMutationState,
  formData: FormData,
): Promise<WorkspaceMutationState> {
  try {
    const context = await requireOrganizationRole(ORGANIZATION_OPERATIONAL_ROLES);
    const parsed = createWorkspaceKnowledgeSchema.safeParse({
      propertyId: formData.get("propertyId"),
      category: formData.get("category"),
      title: formData.get("title"),
      body: formData.get("body"),
      locale: formData.get("locale") || "en",
    });

    if (!parsed.success) {
      return { error: "Enter a title, category, property, and the knowledge details." };
    }

    const supabase = await createSupabaseServerClient();
    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select("id, organization_id")
      .eq("id", parsed.data.propertyId)
      .eq("organization_id", context.organization.id)
      .maybeSingle();

    if (propertyError || !property) {
      return { error: "That property is not available in this workspace." };
    }

    const { error } = await supabase.from("property_knowledge").insert({
      organization_id: context.organization.id,
      property_id: property.id,
      category: parsed.data.category,
      title: parsed.data.title,
      body: parsed.data.body,
      locale: parsed.data.locale,
      status: "published",
    });

    if (error) {
      return { error: "Unable to save this knowledge entry." };
    }

    await supabase.from("events").insert({
      organization_id: context.organization.id,
      property_id: property.id,
      actor_user_id: context.user.id,
      event_type: "knowledge.created",
      metadata: { title: parsed.data.title, category: parsed.data.category },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    return { error: publicMutationError(error) };
  }

  redirect(CLIENT_ROUTES.knowledge);
}

async function uniqueReservationReference(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organizationId: string,
) {
  const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");

  for (let attempt = 1; attempt < 20; attempt += 1) {
    const reference = `DIR-${day}-${attempt.toString().padStart(2, "0")}`;
    const { data } = await supabase
      .from("reservations")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("reservation_reference", reference)
      .maybeSingle();

    if (!data) {
      return reference;
    }
  }

  return `DIR-${day}-${Date.now().toString(36).toUpperCase()}`;
}

async function findOrCreateWorkspaceGuest(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  context: Awaited<ReturnType<typeof requireOrganizationRole>>,
  input: {
    guestMode: "existing" | "new";
    guestId?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  },
) {
  const organizationId = context.organization.id;

  if (input.guestMode === "existing") {
    const parsedId = uuidSchema.safeParse(input.guestId);

    if (!parsedId.success) {
      throw new ValidationError("Choose an existing guest from this organization.");
    }

    const { data: guest, error } = await supabase
      .from("guests")
      .select("id")
      .eq("id", parsedId.data)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (error || !guest) {
      throw new ValidationError("That guest is not available in this workspace.");
    }

    return { guestId: guest.id, created: false };
  }

  const parsedGuest = createWorkspaceGuestSchema.safeParse({
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
  });

  if (!parsedGuest.success) {
    throw new ValidationError("Enter the guest first name and last name.");
  }

  if (parsedGuest.data.email) {
    const { data: existing } = await supabase
      .from("guests")
      .select("id")
      .eq("organization_id", organizationId)
      .ilike("email", parsedGuest.data.email)
      .maybeSingle();

    if (existing) {
      return { guestId: existing.id, created: false };
    }
  }

  const { data: created, error } = await supabase
    .from("guests")
    .insert({
      organization_id: organizationId,
      first_name: parsedGuest.data.firstName,
      last_name: parsedGuest.data.lastName,
      email: parsedGuest.data.email ?? null,
      phone: parsedGuest.data.phone ?? null,
    })
    .select("id")
    .maybeSingle();

  if (error || !created) {
    throw new ValidationError("Unable to create this guest.");
  }

  await supabase.from("events").insert({
    organization_id: organizationId,
    actor_user_id: context.user.id,
    event_type: "guest.created",
    metadata: { guestId: created.id },
  });

  return { guestId: created.id, created: true };
}

export async function createWorkspaceReservationAction(
  _previous: WorkspaceMutationState,
  formData: FormData,
): Promise<WorkspaceMutationState> {
  let createdReservationId = "";

  try {
    const context = await requireOrganizationRole(ORGANIZATION_OPERATIONAL_ROLES);
    const parsed = createWorkspaceReservationSchema.safeParse({
      propertyId: formData.get("propertyId"),
      guestMode: formData.get("guestMode") || "existing",
      guestId: formData.get("guestId") || undefined,
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      checkIn: formData.get("checkIn"),
      checkOut: formData.get("checkOut"),
      status: formData.get("status") || "upcoming",
    });

    if (!parsed.success) {
      return {
        error: "Choose a property and guest, and enter an arrival before the departure.",
      };
    }

    const supabase = await createSupabaseServerClient();
    const organizationId = context.organization.id;
    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select("id")
      .eq("id", parsed.data.propertyId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (propertyError || !property) {
      return { error: "That property is not available in this workspace." };
    }

    const guest = await findOrCreateWorkspaceGuest(supabase, context, parsed.data);
    const reference = await uniqueReservationReference(supabase, organizationId);
    const { data, error } = await supabase
      .from("reservations")
      .insert({
        organization_id: organizationId,
        property_id: property.id,
        guest_id: guest.guestId,
        reservation_reference: reference,
        booking_source: "direct",
        check_in: parsed.data.checkIn,
        check_out: parsed.data.checkOut,
        status: parsed.data.status,
      })
      .select("id")
      .maybeSingle();

    if (error || !data) {
      return { error: "Unable to create this reservation." };
    }

    await supabase.from("events").insert({
      organization_id: organizationId,
      property_id: property.id,
      reservation_id: data.id,
      guest_id: guest.guestId,
      actor_user_id: context.user.id,
      event_type: "reservation.created",
      metadata: {
        reference,
        guestCreated: guest.created,
      },
    });

    createdReservationId = data.id;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    return { error: publicMutationError(error) };
  }

  redirect(clientReservationPath(createdReservationId));
}

export async function updateWorkspaceReservationStatusAction(
  reservationId: string,
  _previous: WorkspaceMutationState,
  formData: FormData,
): Promise<WorkspaceMutationState> {
  try {
    const context = await requireOrganizationRole(ORGANIZATION_OPERATIONAL_ROLES);
    const parsedId = uuidSchema.safeParse(reservationId);
    const parsed = updateWorkspaceReservationStatusSchema.safeParse({
      status: formData.get("status"),
    });

    if (!parsedId.success || !parsed.success) {
      return { error: "Choose a valid reservation status." };
    }

    const supabase = await createSupabaseServerClient();
    const { data: reservation, error: lookupError } = await supabase
      .from("reservations")
      .select("id, status, property_id, guest_id")
      .eq("id", parsedId.data)
      .eq("organization_id", context.organization.id)
      .maybeSingle();

    if (lookupError || !reservation) {
      return { error: "That reservation is not available in this workspace." };
    }

    const { error } = await supabase
      .from("reservations")
      .update({ status: parsed.data.status })
      .eq("id", reservation.id)
      .eq("organization_id", context.organization.id);

    if (error) {
      return { error: "Unable to update this reservation." };
    }

    await supabase.from("events").insert({
      organization_id: context.organization.id,
      property_id: reservation.property_id,
      reservation_id: reservation.id,
      guest_id: reservation.guest_id,
      actor_user_id: context.user.id,
      event_type: "reservation.status_changed",
      metadata: {
        previousStatus: reservation.status,
        status: parsed.data.status,
      },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    return { error: publicMutationError(error) };
  }

  redirect(clientReservationPath(reservationId));
}

export async function updateWorkspaceGuestAction(
  guestId: string,
  _previous: WorkspaceMutationState,
  formData: FormData,
): Promise<WorkspaceMutationState> {
  try {
    const context = await requireOrganizationRole(ORGANIZATION_OPERATIONAL_ROLES);
    const parsedId = uuidSchema.safeParse(guestId);
    const parsed = updateWorkspaceGuestSchema.safeParse({
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      email: formData.get("email"),
      phone: formData.get("phone"),
    });

    if (!parsedId.success || !parsed.success) {
      return { error: "Enter the guest name." };
    }

    const supabase = await createSupabaseServerClient();
    const { data: guest, error: lookupError } = await supabase
      .from("guests")
      .select("id")
      .eq("id", parsedId.data)
      .eq("organization_id", context.organization.id)
      .maybeSingle();

    if (lookupError || !guest) {
      return { error: "That guest is not available in this workspace." };
    }

    const { error } = await supabase
      .from("guests")
      .update({
        first_name: parsed.data.firstName,
        last_name: parsed.data.lastName,
        email: parsed.data.email ?? null,
        phone: parsed.data.phone ?? null,
      })
      .eq("id", guest.id)
      .eq("organization_id", context.organization.id);

    if (error) {
      return { error: "Unable to update this guest." };
    }

    await supabase.from("events").insert({
      organization_id: context.organization.id,
      guest_id: guest.id,
      actor_user_id: context.user.id,
      event_type: "guest.updated",
      metadata: { guestId: guest.id },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    return { error: publicMutationError(error) };
  }

  redirect(`${CLIENT_ROUTES.guests}/${guestId}`);
}
