import "server-only";

import { isBrandingLogoPath } from "@/lib/branding/logo";
import { createServiceRoleClient } from "@/lib/database/admin";
import { isPropertyMediaObjectPath } from "@/lib/property-cms/media";
import { PRIVATE_STORAGE_BUCKETS } from "@/lib/storage/paths";

const GUEST_MEDIA_TTL_SECONDS = 15 * 60;

async function signPrivateObject(bucket: string, path: string) {
  const privileged = createServiceRoleClient();
  const { data, error } = await privileged.storage
    .from(bucket)
    .createSignedUrl(path, GUEST_MEDIA_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

export async function createGuestPropertyMediaSignedUrl(tokenHash: string, mediaId: string) {
  const privileged = createServiceRoleClient();
  const { data, error } = await privileged.rpc("authorize_guest_property_media", {
    p_token_hash: tokenHash,
    p_media_id: mediaId,
  });

  if (error || typeof data !== "string" || !isPropertyMediaObjectPath(data)) {
    return null;
  }

  return signPrivateObject(PRIVATE_STORAGE_BUCKETS.propertyMedia, data);
}

export async function createGuestOperatorLogoSignedUrl(logoPath: string | null | undefined) {
  if (!logoPath || !isBrandingLogoPath(logoPath)) {
    return null;
  }

  return signPrivateObject(PRIVATE_STORAGE_BUCKETS.organizationBranding, logoPath);
}
