export function organizationAssetPrefix(organizationId: string) {
  return `organizations/${organizationId}`;
}

export function propertyMediaPrefix(organizationId: string, propertyId: string) {
  return `${organizationAssetPrefix(organizationId)}/properties/${propertyId}`;
}

export function guestDocumentPrefix(
  organizationId: string,
  reservationId: string,
) {
  return `${organizationAssetPrefix(organizationId)}/reservations/${reservationId}/documents`;
}

export const PRIVATE_STORAGE_BUCKETS = {
  organizationAssets: "organization-assets",
  propertyMedia: "property-media",
  guestDocuments: "guest-documents",
  organizationBranding: "organization-branding",
} as const;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function organizationIdFromStoragePath(path: string) {
  const parts = path.split("/").filter((part) => part.length > 0);

  if (parts[0] !== "organizations") {
    return null;
  }

  const organizationId = parts[1];

  if (!organizationId || !UUID_PATTERN.test(organizationId)) {
    return null;
  }

  return organizationId.toLowerCase();
}
