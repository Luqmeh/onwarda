import "server-only";

import { AppError, AuthorizationError } from "@/lib/errors";
import { createServiceRoleClient } from "@/lib/database/admin";
import { organizationIdFromStoragePath } from "@/lib/storage/paths";
import { requireOrganizationMembership } from "@/lib/tenancy/context";

export async function createPrivateSignedUrl(
  bucket: string,
  path: string,
  expiresInSeconds = 60,
) {
  const organizationId = organizationIdFromStoragePath(path);

  if (!organizationId) {
    throw new AuthorizationError(
      "Storage paths must be organization-scoped.",
    );
  }

  await requireOrganizationMembership(organizationId);

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new AppError("storage_error", "Unable to create a signed URL.", 500);
  }

  return data.signedUrl;
}
