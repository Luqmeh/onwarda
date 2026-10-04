import "server-only";

import { isBrandingLogoPath } from "@/lib/branding/logo";
import { createServiceRoleClient } from "@/lib/database/admin";
import { createSupabaseServerClient } from "@/lib/database/server";
import { isPropertyMediaObjectPath } from "@/lib/property-cms/media";
import { PRIVATE_STORAGE_BUCKETS } from "@/lib/storage/paths";

const PUBLIC_MEDIA_TTL_SECONDS = 15 * 60;

async function signPrivateObject(bucket: string, path: string) {
  const privileged = createServiceRoleClient();
  const { data, error } = await privileged.storage
    .from(bucket)
    .createSignedUrl(path, PUBLIC_MEDIA_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

export async function createPublicPropertyMediaSignedUrl(input: {
  organizationSlug: string;
  propertySlug: string;
  mediaId: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("authorize_public_property_media", {
    p_org_slug: input.organizationSlug,
    p_property_slug: input.propertySlug,
    p_media_id: input.mediaId,
  });

  if (error || typeof data !== "string" || !isPropertyMediaObjectPath(data)) {
    return null;
  }

  return signPrivateObject(PRIVATE_STORAGE_BUCKETS.propertyMedia, data);
}

export async function createPublicOperatorLogoSignedUrl(organizationSlug: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("authorize_public_operator_logo", {
    p_slug: organizationSlug,
  });

  if (error || typeof data !== "string" || !isBrandingLogoPath(data)) {
    return null;
  }

  return signPrivateObject(PRIVATE_STORAGE_BUCKETS.organizationBranding, data);
}
