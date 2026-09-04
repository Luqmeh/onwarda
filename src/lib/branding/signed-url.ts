import "server-only";

import { requirePlatformAdmin } from "@/lib/authorization/platform-admin";
import { createServiceRoleClient } from "@/lib/database/admin";
import { createSupabaseServerClient } from "@/lib/database/server";
import {
  brandingOrganizationIdFromLogoPath,
  isBrandingLogoPath,
} from "@/lib/branding/logo";
import { PRIVATE_STORAGE_BUCKETS } from "@/lib/storage/paths";

const LOGO_SIGNED_URL_SECONDS = 60 * 60;

export async function createWorkspaceBrandingLogoSignedUrl(path: string) {
  if (!isBrandingLogoPath(path)) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage
    .from(PRIVATE_STORAGE_BUCKETS.organizationBranding)
    .createSignedUrl(path, LOGO_SIGNED_URL_SECONDS);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

export async function createAdminBrandingLogoSignedUrl(
  organizationId: string,
  path: string,
) {
  await requirePlatformAdmin();

  if (!isBrandingLogoPath(path)) {
    return null;
  }

  const scopedOrganizationId = brandingOrganizationIdFromLogoPath(path);

  if (scopedOrganizationId !== organizationId.toLowerCase()) {
    return null;
  }

  const privileged = createServiceRoleClient();
  const { data, error } = await privileged.storage
    .from(PRIVATE_STORAGE_BUCKETS.organizationBranding)
    .createSignedUrl(path, LOGO_SIGNED_URL_SECONDS);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}
