"use server";

import { redirect } from "next/navigation";

import { CLIENT_ROUTES } from "@/config/client";
import { ORGANIZATION_ADMIN_ROLES } from "@/lib/authorization/roles";
import {
  brandingLogoPath,
  brandingOrganizationIdFromLogoPath,
  readBrandingLogoFile,
} from "@/lib/branding/logo";
import { createSupabaseServerClient } from "@/lib/database/server";
import {
  AuthenticationError,
  AuthorizationError,
  TenantIsolationError,
  ValidationError,
} from "@/lib/errors";
import { PRIVATE_STORAGE_BUCKETS } from "@/lib/storage/paths";
import { requireOrganizationRole } from "@/lib/tenancy/context";
import { organizationBrandingFieldsSchema } from "@/lib/validation/branding";

export type WorkspaceBrandingMutationState = {
  error?: string;
};

function publicBrandingError(error: unknown) {
  if (
    error instanceof ValidationError ||
    error instanceof AuthorizationError ||
    error instanceof TenantIsolationError
  ) {
    return error.message;
  }

  return "Organization branding could not be updated.";
}

async function currentBrandingLogoPath(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organizationId: string,
) {
  const { data } = await supabase
    .from("organization_branding")
    .select("logo_path")
    .eq("organization_id", organizationId)
    .maybeSingle();

  return data?.logo_path ?? null;
}

export async function updateWorkspaceBrandingAction(
  _previous: WorkspaceBrandingMutationState,
  formData: FormData,
): Promise<WorkspaceBrandingMutationState> {
  try {
    const context = await requireOrganizationRole(ORGANIZATION_ADMIN_ROLES);
    const organizationId = context.organization.id;
    const parsed = organizationBrandingFieldsSchema.safeParse({
      displayName: formData.get("displayName"),
      primaryColor: formData.get("primaryColor"),
      secondaryColor: formData.get("secondaryColor"),
      accentColor: formData.get("accentColor"),
    });

    if (!parsed.success) {
      return { error: "Enter a valid display name and #RRGGBB brand colors." };
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("organization_branding")
      .update({
        display_name: parsed.data.displayName,
        primary_color: parsed.data.primaryColor,
        secondary_color: parsed.data.secondaryColor,
        accent_color: parsed.data.accentColor,
      })
      .eq("organization_id", organizationId);

    if (error) {
      return { error: "Unable to update organization branding." };
    }

    const logo = formData.get("logo");

    if (logo instanceof File && logo.size > 0) {
      const detected = await readBrandingLogoFile(logo);
      const nextPath = brandingLogoPath(organizationId, detected.extension);
      const previousPath = await currentBrandingLogoPath(supabase, organizationId);
      const { error: uploadError } = await supabase.storage
        .from(PRIVATE_STORAGE_BUCKETS.organizationBranding)
        .upload(nextPath, detected.bytes, {
          contentType: detected.mime,
          upsert: true,
        });

      if (uploadError) {
        return { error: "The logo could not be stored." };
      }

      const { error: logoError } = await supabase
        .from("organization_branding")
        .update({ logo_path: nextPath })
        .eq("organization_id", organizationId);

      if (logoError) {
        return { error: "Unable to update the organization logo." };
      }

      if (previousPath && previousPath !== nextPath) {
        await supabase.storage
          .from(PRIVATE_STORAGE_BUCKETS.organizationBranding)
          .remove([previousPath]);
      }

      await supabase.from("events").insert({
        organization_id: organizationId,
        actor_user_id: context.user.id,
        event_type: "organization.branding_logo_uploaded",
        metadata: { hasLogo: true },
      });
    }

    await supabase.from("events").insert({
      organization_id: organizationId,
      actor_user_id: context.user.id,
      event_type: "organization.branding_updated",
      metadata: {
        displayName: parsed.data.displayName,
        primaryColor: parsed.data.primaryColor,
        secondaryColor: parsed.data.secondaryColor,
        accentColor: parsed.data.accentColor,
      },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    return { error: publicBrandingError(error) };
  }

  redirect(`${CLIENT_ROUTES.settings}?notice=branding-updated`);
}

export async function removeWorkspaceBrandingLogoAction(
  previous: WorkspaceBrandingMutationState,
  formData: FormData,
): Promise<WorkspaceBrandingMutationState> {
  void previous;
  void formData;
  try {
    const context = await requireOrganizationRole(ORGANIZATION_ADMIN_ROLES);
    const organizationId = context.organization.id;
    const supabase = await createSupabaseServerClient();
    const previousPath = await currentBrandingLogoPath(supabase, organizationId);

    const { error } = await supabase
      .from("organization_branding")
      .update({ logo_path: null })
      .eq("organization_id", organizationId);

    if (error) {
      return { error: "Unable to remove the organization logo." };
    }

    if (
      previousPath &&
      brandingOrganizationIdFromLogoPath(previousPath) === organizationId.toLowerCase()
    ) {
      await supabase.storage
        .from(PRIVATE_STORAGE_BUCKETS.organizationBranding)
        .remove([previousPath]);
    }

    await supabase.from("events").insert({
      organization_id: organizationId,
      actor_user_id: context.user.id,
      event_type: "organization.branding_logo_removed",
      metadata: { hasLogo: false },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    return { error: publicBrandingError(error) };
  }

  redirect(`${CLIENT_ROUTES.settings}?notice=branding-logo-removed`);
}
