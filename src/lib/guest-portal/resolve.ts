import "server-only";

import { AuthorizationError } from "@/lib/errors";
import { createServiceRoleClient } from "@/lib/database/admin";
import { hashGuestPortalToken } from "@/lib/guest-portal/tokens";
import { guestPortalTokenSchema } from "@/lib/validation/guest-token";

export type ResolvedGuestPortal = {
  tokenId: string;
  organizationId: string;
  reservationId: string;
  propertyId: string;
  guestId: string;
};

export async function resolveGuestPortalToken(
  token: string,
): Promise<ResolvedGuestPortal> {
  const parsed = guestPortalTokenSchema.safeParse(token);

  if (!parsed.success) {
    throw new AuthorizationError("This guest link is invalid.");
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("resolve_guest_portal_token", {
    p_token_hash: hashGuestPortalToken(parsed.data),
  });

  if (error) {
    throw new AuthorizationError("Unable to resolve this guest link.");
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row) {
    throw new AuthorizationError("This guest link is invalid.");
  }

  return {
    tokenId: row.token_id,
    organizationId: row.organization_id,
    reservationId: row.reservation_id,
    propertyId: row.property_id,
    guestId: row.guest_id,
  };
}

// Future Guest Portal branding: reservation → guest → property → organization
// → organization_branding. After this token resolves, load branding by
// organizationId. Do not make the branding bucket public; issue a
// token-authorized signed URL from a server helper.
