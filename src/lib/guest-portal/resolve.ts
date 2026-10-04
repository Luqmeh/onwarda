import "server-only";

import { AuthorizationError } from "@/lib/errors";
import { createServiceRoleClient } from "@/lib/database/admin";
import { hashGuestPortalToken } from "@/lib/guest-portal/tokens";
import { guestPortalTokenSchema } from "@/lib/validation/guest-token";

export type GuestTokenStatus = "valid" | "invalid" | "expired" | "revoked" | "unavailable";

export type ResolvedGuestPortal = {
  status: "valid";
  tokenId: string;
  organizationId: string;
  reservationId: string;
  propertyId: string;
  guestId: string;
  tokenHash: string;
};

export type InspectedGuestPortal =
  | ResolvedGuestPortal
  | { status: Exclude<GuestTokenStatus, "valid"> };

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export async function inspectGuestPortalToken(token: string): Promise<InspectedGuestPortal> {
  const parsed = guestPortalTokenSchema.safeParse(token);

  if (!parsed.success) {
    return { status: "invalid" };
  }

  const tokenHash = hashGuestPortalToken(parsed.data);
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("inspect_guest_portal_token", {
    p_token_hash: tokenHash,
  });

  if (error) {
    return { status: "invalid" };
  }

  const row = Array.isArray(data) ? asRecord(data[0]) : asRecord(data);

  if (!row) {
    return { status: "invalid" };
  }

  const status = row.status;

  if (status === "expired" || status === "revoked" || status === "unavailable") {
    return { status };
  }

  if (
    status !== "valid" ||
    typeof row.token_id !== "string" ||
    typeof row.organization_id !== "string" ||
    typeof row.reservation_id !== "string" ||
    typeof row.property_id !== "string" ||
    typeof row.guest_id !== "string"
  ) {
    return { status: "invalid" };
  }

  return {
    status: "valid",
    tokenId: row.token_id,
    organizationId: row.organization_id,
    reservationId: row.reservation_id,
    propertyId: row.property_id,
    guestId: row.guest_id,
    tokenHash,
  };
}

export async function resolveGuestPortalToken(token: string): Promise<ResolvedGuestPortal> {
  const inspected = await inspectGuestPortalToken(token);

  if (inspected.status !== "valid") {
    throw new AuthorizationError("This guest link is invalid.");
  }

  return inspected;
}
