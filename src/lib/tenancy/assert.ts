import { TenantIsolationError } from "@/lib/errors";

export function assertSameOrganization(
  membershipOrganizationId: string,
  requestedOrganizationId: string,
) {
  if (membershipOrganizationId !== requestedOrganizationId) {
    throw new TenantIsolationError(
      "The authenticated user does not belong to the requested organization.",
    );
  }
}

export function resolveTrustedOrganizationId(
  membershipOrganizationId: string,
  requestedOrganizationId?: string | null,
) {
  if (
    requestedOrganizationId &&
    requestedOrganizationId !== membershipOrganizationId
  ) {
    throw new TenantIsolationError(
      "Client-supplied organization identifiers are not trusted.",
    );
  }

  return membershipOrganizationId;
}
