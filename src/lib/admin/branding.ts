"use server";

import { redirect } from "next/navigation";

import { adminClientPath } from "@/config/admin";
import { requireActivePlatformAdminWithMfa } from "@/lib/authorization/platform-admin";
import {
  brandingLogoPath,
  brandingOrganizationIdFromLogoPath,
  readBrandingLogoFile,
} from "@/lib/branding/logo";
import {
  resolveOrganizationBranding,
  type ResolvedOrganizationBranding,
} from "@/lib/branding/resolve";
import { createAdminBrandingLogoSignedUrl } from "@/lib/branding/signed-url";
import { createServiceRoleClient } from "@/lib/database/admin";
import { createSupabaseServerClient } from "@/lib/database/server";
import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  toPublicErrorMessage,
} from "@/lib/errors";
import { PRIVATE_STORAGE_BUCKETS } from "@/lib/storage/paths";
import { organizationBrandingFieldsSchema } from "@/lib/validation/branding";
import { uuidSchema } from "@/lib/validation/common";
import type { OrganizationBrandingRecord } from "@/types/database";

export type AdminBrandingMutationState = {
  error?: string;
};

type BrandingRow = Pick<
  OrganizationBrandingRecord,
  | "organization_id"
  | "display_name"
  | "public_description"
  | "logo_path"
  | "primary_color"
  | "secondary_color"
  | "accent_color"
>;

function publicBrandingError(error: unknown) {
  if (error instanceof ValidationError || error instanceof AppError) {
    return error.message;
  }

  if (/invalid brand color|invalid display name|invalid logo path/i.test(String(
    error instanceof Error ? error.message : error,
  ))) {
    return "Enter a valid display name and #RRGGBB brand colors.";
  }

  return toPublicErrorMessage(error);
}

function parseBrandingFields(formData: FormData) {
  const parsed = organizationBrandingFieldsSchema.safeParse({
    displayName: formData.get("displayName"),
    primaryColor: formData.get("primaryColor"),
    secondaryColor: formData.get("secondaryColor"),
    accentColor: formData.get("accentColor"),
  });

  if (!parsed.success) {
    throw new ValidationError(
      "Enter a valid display name and #RRGGBB brand colors.",
    );
  }

  return parsed.data;
}

function hasBrandingInput(formData: FormData) {
  const logo = formData.get("logo");
  const hasLogo = logo instanceof File && logo.size > 0;

  return Boolean(
    hasLogo ||
      String(formData.get("displayName") ?? "").trim() ||
      String(formData.get("primaryColor") ?? "").trim() ||
      String(formData.get("secondaryColor") ?? "").trim() ||
      String(formData.get("accentColor") ?? "").trim(),
  );
}

export async function getAdminOrganizationBranding(
  organizationId: string,
): Promise<ResolvedOrganizationBranding> {
  await requireActivePlatformAdminWithMfa();

  const parsedId = uuidSchema.safeParse(organizationId);

  if (!parsedId.success) {
    throw new ValidationError("A valid organization is required.");
  }

  const privileged = createServiceRoleClient();
  const [{ data: organization, error: organizationError }, { data: branding, error: brandingError }] =
    await Promise.all([
      privileged
        .from("organizations")
        .select("id, name")
        .eq("id", parsedId.data)
        .maybeSingle(),
      privileged
        .from("organization_branding")
        .select(
          "organization_id, display_name, public_description, logo_path, primary_color, secondary_color, accent_color",
        )
        .eq("organization_id", parsedId.data)
        .maybeSingle(),
    ]);

  if (organizationError || brandingError || !organization) {
    throw new AppError(
      "admin_branding_unavailable",
      "Unable to load organization branding.",
      500,
    );
  }

  const record = (branding as BrandingRow | null) ?? null;
  const logoUrl = record?.logo_path
    ? await createAdminBrandingLogoSignedUrl(parsedId.data, record.logo_path)
    : null;

  return resolveOrganizationBranding({
    organizationId: organization.id,
    organizationName: organization.name,
    branding: record,
    logoUrl,
  });
}

export async function updateAdminOrganizationBranding(input: {
  organizationId: string;
  displayName: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
}) {
  await requireActivePlatformAdminWithMfa();

  const parsedId = uuidSchema.safeParse(input.organizationId);

  if (!parsedId.success) {
    throw new ValidationError("A valid organization is required.");
  }

  const parsed = organizationBrandingFieldsSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError(
      "Enter a valid display name and #RRGGBB brand colors.",
    );
  }

  const scoped = await createSupabaseServerClient();
  const { error } = await scoped.rpc("admin_set_organization_branding", {
    p_organization_id: parsedId.data,
    p_display_name: parsed.data.displayName,
    p_primary_color: parsed.data.primaryColor,
    p_secondary_color: parsed.data.secondaryColor,
    p_accent_color: parsed.data.accentColor,
  });

  if (error) {
    throw new AppError(
      "admin_branding_update_failed",
      publicBrandingError(error),
      400,
    );
  }
}

async function replaceAdminOrganizationLogo(
  organizationId: string,
  file: File,
) {
  await requireActivePlatformAdminWithMfa();

  const parsedId = uuidSchema.safeParse(organizationId);

  if (!parsedId.success) {
    throw new ValidationError("A valid organization is required.");
  }

  const detected = await readBrandingLogoFile(file);
  const nextPath = brandingLogoPath(parsedId.data, detected.extension);
  const privileged = createServiceRoleClient();

  const { data: current } = await privileged
    .from("organization_branding")
    .select("logo_path")
    .eq("organization_id", parsedId.data)
    .maybeSingle();

  const { error: uploadError } = await privileged.storage
    .from(PRIVATE_STORAGE_BUCKETS.organizationBranding)
    .upload(nextPath, detected.bytes, {
      contentType: detected.mime,
      upsert: true,
    });

  if (uploadError) {
    throw new AppError(
      "admin_branding_logo_failed",
      "The logo could not be stored.",
      500,
    );
  }

  const scoped = await createSupabaseServerClient();
  const { error } = await scoped.rpc("admin_set_organization_branding_logo", {
    p_organization_id: parsedId.data,
    p_logo_path: nextPath,
  });

  if (error) {
    throw new AppError(
      "admin_branding_logo_failed",
      publicBrandingError(error),
      400,
    );
  }

  const previousPath = current?.logo_path ?? null;

  if (previousPath && previousPath !== nextPath) {
    await privileged.storage
      .from(PRIVATE_STORAGE_BUCKETS.organizationBranding)
      .remove([previousPath]);
  }
}

export async function removeAdminOrganizationLogo(organizationId: string) {
  await requireActivePlatformAdminWithMfa();

  const parsedId = uuidSchema.safeParse(organizationId);

  if (!parsedId.success) {
    throw new ValidationError("A valid organization is required.");
  }

  const privileged = createServiceRoleClient();
  const { data: current } = await privileged
    .from("organization_branding")
    .select("logo_path")
    .eq("organization_id", parsedId.data)
    .maybeSingle();

  const scoped = await createSupabaseServerClient();
  const { error } = await scoped.rpc("admin_set_organization_branding_logo", {
    p_organization_id: parsedId.data,
    p_logo_path: null,
  });

  if (error) {
    throw new AppError(
      "admin_branding_logo_failed",
      publicBrandingError(error),
      400,
    );
  }

  if (
    current?.logo_path &&
    brandingOrganizationIdFromLogoPath(current.logo_path) === parsedId.data.toLowerCase()
  ) {
    await privileged.storage
      .from(PRIVATE_STORAGE_BUCKETS.organizationBranding)
      .remove([current.logo_path]);
  }
}

export async function applyProvisionedOrganizationBranding(
  organizationId: string,
  formData: FormData,
) {
  if (!hasBrandingInput(formData)) {
    return;
  }

  const fields = parseBrandingFields(formData);
  await updateAdminOrganizationBranding({
    organizationId,
    ...fields,
  });

  const logo = formData.get("logo");

  if (logo instanceof File && logo.size > 0) {
    await replaceAdminOrganizationLogo(organizationId, logo);
  }
}

export async function updateAdminOrganizationBrandingAction(
  organizationId: string,
  _previous: AdminBrandingMutationState,
  formData: FormData,
): Promise<AdminBrandingMutationState> {
  try {
    await requireActivePlatformAdminWithMfa();
    const fields = parseBrandingFields(formData);
    await updateAdminOrganizationBranding({
      organizationId,
      ...fields,
    });

    const logo = formData.get("logo");

    if (logo instanceof File && logo.size > 0) {
      await replaceAdminOrganizationLogo(organizationId, logo);
    }
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    if (error instanceof AuthorizationError) {
      return { error: "Platform administrator access is required." };
    }

    return { error: publicBrandingError(error) };
  }

  redirect(`${adminClientPath(organizationId)}?notice=branding-updated`);
}

export async function removeAdminOrganizationLogoAction(
  organizationId: string,
  previous: AdminBrandingMutationState,
  formData: FormData,
): Promise<AdminBrandingMutationState> {
  void previous;
  void formData;
  try {
    await removeAdminOrganizationLogo(organizationId);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    if (error instanceof AuthorizationError) {
      return { error: "Platform administrator access is required." };
    }

    return { error: publicBrandingError(error) };
  }

  redirect(`${adminClientPath(organizationId)}?notice=branding-logo-removed`);
}
