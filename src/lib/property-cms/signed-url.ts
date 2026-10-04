import "server-only";

import { createSupabaseServerClient } from "@/lib/database/server";
import { isPropertyMediaObjectPath } from "@/lib/property-cms/media";
import { PRIVATE_STORAGE_BUCKETS } from "@/lib/storage/paths";

const MEDIA_SIGNED_URL_SECONDS = 60 * 60;

export async function createPropertyMediaSignedUrl(path: string) {
  if (!isPropertyMediaObjectPath(path)) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage
    .from(PRIVATE_STORAGE_BUCKETS.propertyMedia)
    .createSignedUrl(path, MEDIA_SIGNED_URL_SECONDS);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}
