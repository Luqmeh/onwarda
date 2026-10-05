"use server";

import { redirect } from "next/navigation";

import { CLIENT_ROUTES } from "@/config/client";
import { ORGANIZATION_ADMIN_ROLES } from "@/lib/authorization/roles";
import { createSupabaseServerClient } from "@/lib/database/server";
import { AuthenticationError, AuthorizationError, ValidationError } from "@/lib/errors";
import {
  isOnboardingStep,
  nextOnboardingStep,
  type OnboardingStepId,
} from "@/lib/onboarding/steps";
import { suggestOrganizationSlug } from "@/lib/validation/organization";
import { requireOrganizationRole } from "@/lib/tenancy/context";
import {
  onboardingBusinessSchema,
  onboardingCleanerSchema,
  onboardingGuideSchema,
  onboardingPasswordSchema,
  onboardingPropertyDetailsSchema,
  onboardingPropertySchema,
  onboardingReservationSchema,
} from "@/lib/validation/onboarding";
import { organizationBrandingFieldsSchema } from "@/lib/validation/branding";

export type OnboardingFormState = { error?: string };

function fail(error: unknown): OnboardingFormState {
  if (error instanceof AuthenticationError) {
    throw error;
  }

  if (error instanceof ValidationError || error instanceof AuthorizationError) {
    return { error: error.message };
  }

  return { error: "That step could not be saved. Nothing else was changed." };
}

async function moveTo(step: OnboardingStepId) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("workspace_set_onboarding_step", { p_step: step });

  if (error) {
    throw new AuthorizationError("You cannot change onboarding for this organization.");
  }
}

export async function acceptClientInvitation() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("accept_client_invitation");

  if (error) {
    throw new AuthorizationError("This invitation could not be opened.");
  }

  const result = data as {
    status?: string;
    wasInvited?: boolean;
    onboardingStatus?: string;
    currentStep?: string;
    organizationId?: string;
    role?: string;
  } | null;

  if (result?.wasInvited) {
    await supabase.auth.updateUser({ data: { onwarda_password_ready: false } });
  }

  return result ?? { status: "none" };
}

export async function setOnboardingPasswordAction(
  _previous: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const parsed = onboardingPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: "Use at least 8 characters, and enter the same password twice." };
  }

  try {
    const accepted = await acceptClientInvitation();
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
      data: { onwarda_password_ready: true },
    });

    if (error) {
      return { error: "The password could not be saved. Try a different one." };
    }

    if (accepted.onboardingStatus === "completed") {
      redirect(CLIENT_ROUTES.root);
    }

    await moveTo("business");
  } catch (error) {
    return fail(error);
  }

  redirect("/onboarding");
}

export async function continueOnboardingAction(step: string): Promise<void> {
  if (!isOnboardingStep(step)) {
    throw new ValidationError("That onboarding step is not available.");
  }

  await requireOrganizationRole(ORGANIZATION_ADMIN_ROLES);
  await moveTo(nextOnboardingStep(step));
  redirect("/onboarding");
}

export async function saveOnboardingBusinessAction(
  _previous: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const parsed = onboardingBusinessSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    country: formData.get("country"),
    defaultLanguage: formData.get("defaultLanguage"),
  });

  if (!parsed.success) {
    return { error: "Enter the name guests and your team should see." };
  }

  try {
    const context = await requireOrganizationRole(ORGANIZATION_ADMIN_ROLES);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("organizations")
      .update({
        name: parsed.data.name,
        phone: parsed.data.phone || null,
        country: parsed.data.country || null,
        default_language: parsed.data.defaultLanguage,
      })
      .eq("id", context.organization.id);

    if (error) {
      return { error: "The business profile could not be saved." };
    }

    await supabase.from("events").insert({
      organization_id: context.organization.id,
      actor_user_id: context.user.id,
      event_type: "organization.profile_updated",
      metadata: {},
    });
    await moveTo("branding");
  } catch (error) {
    return fail(error);
  }

  redirect("/onboarding");
}

export async function saveOnboardingBrandingAction(
  _previous: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const parsed = organizationBrandingFieldsSchema.safeParse({
    displayName: formData.get("displayName"),
    publicDescription: formData.get("publicDescription"),
    primaryColor: formData.get("primaryColor"),
    secondaryColor: formData.get("secondaryColor"),
    accentColor: formData.get("accentColor"),
  });

  if (!parsed.success) {
    return { error: "Use a display name and colors as #RRGGBB." };
  }

  try {
    const context = await requireOrganizationRole(ORGANIZATION_ADMIN_ROLES);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("organization_branding")
      .update({
        display_name: parsed.data.displayName,
        public_description: parsed.data.publicDescription ?? null,
        primary_color: parsed.data.primaryColor,
        secondary_color: parsed.data.secondaryColor,
        accent_color: parsed.data.accentColor,
      })
      .eq("organization_id", context.organization.id);

    if (error) {
      return { error: "Branding could not be saved." };
    }

    await moveTo("properties");
  } catch (error) {
    return fail(error);
  }

  redirect("/onboarding");
}

export async function saveOnboardingPropertyAction(
  _previous: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const parsed = onboardingPropertySchema.safeParse({
    name: formData.get("name"),
    propertyType: formData.get("propertyType") || undefined,
    city: formData.get("city"),
    country: formData.get("country"),
  });

  if (!parsed.success) {
    return { error: "Give the property a name." };
  }

  try {
    const context = await requireOrganizationRole(ORGANIZATION_ADMIN_ROLES);
    const supabase = await createSupabaseServerClient();
    const { data: existing } = await supabase
      .from("properties")
      .select("id")
      .eq("organization_id", context.organization.id)
      .ilike("name", parsed.data.name)
      .neq("status", "archived")
      .maybeSingle();

    if (!existing) {
      const base = suggestOrganizationSlug(parsed.data.name) || "property";
      const { error } = await supabase.from("properties").insert({
        organization_id: context.organization.id,
        name: parsed.data.name,
        slug: base,
        property_type: parsed.data.propertyType || null,
        city: parsed.data.city || null,
        country: parsed.data.country || null,
        status: "draft",
      });

      if (error) {
        return { error: "This property could not be added. Try a slightly different name." };
      }

      await supabase.from("events").insert({
        organization_id: context.organization.id,
        actor_user_id: context.user.id,
        event_type: "property.created",
        metadata: { source: "onboarding" },
      });
    }
  } catch (error) {
    return fail(error);
  }

  redirect("/onboarding");
}

export async function saveOnboardingPropertyDetailsAction(
  _previous: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const parsed = onboardingPropertyDetailsSchema.safeParse({
    propertyId: formData.get("propertyId"),
    amenities: formData.getAll("amenities"),
    quietHours: formData.get("quietHours") || "unspecified",
    smoking: formData.get("smoking") || "unspecified",
    pets: formData.get("pets") || "unspecified",
    arrival: formData.get("arrival"),
    wifi: formData.get("wifi"),
  });

  if (!parsed.success) {
    return { error: "Choose one of your properties before saving details." };
  }

  try {
    const context = await requireOrganizationRole(ORGANIZATION_ADMIN_ROLES);
    const supabase = await createSupabaseServerClient();
    const organizationId = context.organization.id;
    const propertyId = parsed.data.propertyId;
    const { data: property } = await supabase
      .from("properties")
      .select("id")
      .eq("id", propertyId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (!property) {
      return { error: "That property is not in this workspace." };
    }

    await supabase.from("property_amenities").delete().eq("property_id", propertyId).eq("organization_id", organizationId);

    if (parsed.data.amenities.length > 0) {
      await supabase.from("property_amenities").insert(
        parsed.data.amenities.map((amenity_key, index) => ({
          organization_id: organizationId,
          property_id: propertyId,
          amenity_key,
          sort_order: (index + 1) * 10,
        })),
      );
    }

    await supabase.from("property_house_rules").delete().eq("property_id", propertyId).eq("organization_id", organizationId);
    const rules = [
      { rule_key: "quiet_hours", state: parsed.data.quietHours },
      { rule_key: "smoking", state: parsed.data.smoking },
      { rule_key: "pets", state: parsed.data.pets },
    ].filter((rule) => rule.state !== "unspecified");

    if (rules.length > 0) {
      await supabase.from("property_house_rules").insert(
        rules.map((rule, index) => ({
          organization_id: organizationId,
          property_id: propertyId,
          rule_key: rule.rule_key,
          state: rule.state,
          visibility: "guest",
          sort_order: (index + 1) * 10,
        })),
      );
    }

    if (parsed.data.arrival) {
      await supabase
        .from("property_content")
        .delete()
        .eq("property_id", propertyId)
        .eq("organization_id", organizationId)
        .eq("field_key", "arrival_instructions");
      await supabase.from("property_content").insert({
        organization_id: organizationId,
        property_id: propertyId,
        field_key: "arrival_instructions",
        body: parsed.data.arrival,
        visibility: "guest",
      });
    }

    if (parsed.data.wifi) {
      const { data: wifiGuide } = await supabase
        .from("property_knowledge")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("property_id", propertyId)
        .eq("category", "wifi")
        .maybeSingle();

      if (!wifiGuide) {
        await supabase.from("property_knowledge").insert({
          organization_id: organizationId,
          property_id: propertyId,
          category: "wifi",
          title: "Wi-Fi",
          body: parsed.data.wifi,
          locale: "en",
          visibility: "guest",
          status: "published",
          sort_order: 5,
        });
      }
    }

    await moveTo("guides");
  } catch (error) {
    return fail(error);
  }

  redirect("/onboarding");
}

export async function saveOnboardingGuideAction(
  _previous: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const parsed = onboardingGuideSchema.safeParse({
    propertyId: formData.get("propertyId"),
    title: formData.get("title"),
    body: formData.get("body"),
    category: formData.get("category") || "appliance",
  });

  if (!parsed.success) {
    return { error: "Add a title and a short explanation for this guide." };
  }

  try {
    const context = await requireOrganizationRole(ORGANIZATION_ADMIN_ROLES);
    const supabase = await createSupabaseServerClient();
    const { data: property } = await supabase
      .from("properties")
      .select("id")
      .eq("id", parsed.data.propertyId)
      .eq("organization_id", context.organization.id)
      .maybeSingle();

    if (!property) {
      return { error: "That property is not in this workspace." };
    }

    const { data: existing } = await supabase
      .from("property_knowledge")
      .select("id")
      .eq("organization_id", context.organization.id)
      .eq("property_id", parsed.data.propertyId)
      .ilike("title", parsed.data.title)
      .maybeSingle();

    if (!existing) {
      const { error } = await supabase.from("property_knowledge").insert({
        organization_id: context.organization.id,
        property_id: parsed.data.propertyId,
        category: parsed.data.category,
        title: parsed.data.title,
        body: parsed.data.body,
        locale: "en",
        visibility: "guest",
        status: "published",
        sort_order: 10,
      });

      if (error) {
        return { error: "This guide could not be saved." };
      }
    }
  } catch (error) {
    return fail(error);
  }

  redirect("/onboarding");
}

export async function saveOnboardingCleanerAction(
  _previous: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const parsed = onboardingCleanerSchema.safeParse({
    displayName: formData.get("displayName"),
    propertyId: formData.get("propertyId") || undefined,
  });

  if (!parsed.success) {
    return { error: "Enter the cleaner's name." };
  }

  try {
    const context = await requireOrganizationRole(ORGANIZATION_ADMIN_ROLES);
    const supabase = await createSupabaseServerClient();
    const { data: existing } = await supabase
      .from("cleaning_agents")
      .select("id")
      .eq("organization_id", context.organization.id)
      .ilike("display_name", parsed.data.displayName)
      .maybeSingle();

    let agentId = existing?.id;

    if (!agentId) {
      const { data, error } = await supabase
        .from("cleaning_agents")
        .insert({
          organization_id: context.organization.id,
          display_name: parsed.data.displayName,
          active: true,
        })
        .select("id")
        .maybeSingle();

      if (error || !data) {
        return { error: "This cleaner could not be added." };
      }

      agentId = data.id;
    }

    if (parsed.data.propertyId) {
      const { data: property } = await supabase
        .from("properties")
        .select("id")
        .eq("id", parsed.data.propertyId)
        .eq("organization_id", context.organization.id)
        .maybeSingle();

      if (!property) {
        return { error: "That property is not in this workspace." };
      }

      await supabase.from("property_cleaning_agents").upsert(
        {
          organization_id: context.organization.id,
          property_id: parsed.data.propertyId,
          cleaning_agent_id: agentId,
          active: true,
        },
        { onConflict: "property_id,cleaning_agent_id" },
      );
    }
  } catch (error) {
    return fail(error);
  }

  redirect("/onboarding");
}

export async function saveOnboardingReservationAction(
  _previous: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const parsed = onboardingReservationSchema.safeParse({
    propertyId: formData.get("propertyId"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email") || "",
    checkIn: formData.get("checkIn"),
    checkOut: formData.get("checkOut"),
  });

  if (!parsed.success || parsed.data.checkOut <= parsed.data.checkIn) {
    return { error: "Choose a property, a guest name, and a departure after the arrival." };
  }

  try {
    const context = await requireOrganizationRole(ORGANIZATION_ADMIN_ROLES);
    const supabase = await createSupabaseServerClient();
    const organizationId = context.organization.id;
    const { data: property } = await supabase
      .from("properties")
      .select("id")
      .eq("id", parsed.data.propertyId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (!property) {
      return { error: "That property is not in this workspace." };
    }

    const { data: duplicate } = await supabase
      .from("reservations")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("property_id", parsed.data.propertyId)
      .eq("check_in", parsed.data.checkIn)
      .eq("check_out", parsed.data.checkOut)
      .maybeSingle();

    if (!duplicate) {
      const { data: guest, error: guestError } = await supabase
        .from("guests")
        .insert({
          organization_id: organizationId,
          first_name: parsed.data.firstName,
          last_name: parsed.data.lastName,
          email: parsed.data.email || null,
        })
        .select("id")
        .maybeSingle();

      if (guestError || !guest) {
        return { error: "The guest could not be saved." };
      }

      const { error } = await supabase.from("reservations").insert({
        organization_id: organizationId,
        property_id: parsed.data.propertyId,
        guest_id: guest.id,
        check_in: parsed.data.checkIn,
        check_out: parsed.data.checkOut,
        status: "upcoming",
        booking_source: "direct",
        number_of_guests: 1,
        reservation_reference: `ONB-${parsed.data.checkIn.replaceAll("-", "")}`,
      });

      if (error) {
        return { error: "The stay could not be saved." };
      }
    }

    await moveTo("review");
  } catch (error) {
    return fail(error);
  }

  redirect("/onboarding");
}

export async function finishOnboardingAction(): Promise<void> {
  await requireOrganizationRole(ORGANIZATION_ADMIN_ROLES);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("workspace_complete_onboarding");

  if (error) {
    throw new AuthorizationError("Setup could not be finished.");
  }

  redirect(CLIENT_ROUTES.root);
}
