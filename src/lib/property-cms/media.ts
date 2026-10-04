import { organizationIdFromStoragePath, propertyMediaPrefix } from "@/lib/storage/paths";

export const PROPERTY_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

export const PROPERTY_IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"] as const;

export type PropertyImageExtension = (typeof PROPERTY_IMAGE_EXTENSIONS)[number];

const MEDIA_PATH =
  /^organizations\/[0-9a-fA-F-]{36}\/properties\/[0-9a-fA-F-]{36}\/media\/[0-9a-fA-F-]{36}\.(png|jpg|jpeg|webp)$/;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAGIC: Record<PropertyImageExtension, (bytes: Uint8Array) => boolean> = {
  png: (bytes) =>
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47,
  jpg: (bytes) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  jpeg: (bytes) =>
    bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  webp: (bytes) =>
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50,
};

const MIME_BY_EXTENSION: Record<PropertyImageExtension, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export function propertyMediaObjectPath(
  organizationId: string,
  propertyId: string,
  mediaId: string,
  extension: PropertyImageExtension,
) {
  return `${propertyMediaPrefix(organizationId, propertyId)}/media/${mediaId}.${extension}`;
}

export function isPropertyMediaObjectPath(path: string | null | undefined): path is string {
  return Boolean(path && MEDIA_PATH.test(path));
}

export function propertyIdFromMediaPath(path: string) {
  if (!isPropertyMediaObjectPath(path)) {
    return null;
  }

  const parts = path.split("/").filter((part) => part.length > 0);
  const propertyId = parts[3];

  if (!propertyId || !UUID_PATTERN.test(propertyId)) {
    return null;
  }

  return propertyId.toLowerCase();
}

export function propertyMediaOrganizationIdFromPath(path: string) {
  if (!isPropertyMediaObjectPath(path)) {
    return null;
  }

  return organizationIdFromStoragePath(path);
}

export function detectPropertyImageType(bytes: Uint8Array): {
  extension: PropertyImageExtension;
  mime: string;
} | null {
  if (bytes.length >= 5 && bytes[0] === 0x3c && bytes[1] === 0x73 && bytes[2] === 0x76) {
    return null;
  }

  for (const extension of PROPERTY_IMAGE_EXTENSIONS) {
    if (MAGIC[extension](bytes)) {
      return { extension, mime: MIME_BY_EXTENSION[extension] };
    }
  }

  return null;
}

export function validatePropertyImageBytes(bytes: Uint8Array) {
  if (bytes.byteLength === 0) {
    throw new Error("Choose an image file to upload.");
  }

  if (bytes.byteLength > PROPERTY_IMAGE_MAX_BYTES) {
    throw new Error("Property images must be 8 MB or smaller.");
  }

  const detected = detectPropertyImageType(bytes);

  if (!detected) {
    throw new Error("Property images must be PNG, JPEG, or WebP files.");
  }

  return detected;
}

export async function readPropertyImageFile(file: File) {
  if (file.size > PROPERTY_IMAGE_MAX_BYTES) {
    throw new Error("Property images must be 8 MB or smaller.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  return {
    bytes,
    ...validatePropertyImageBytes(bytes),
  };
}
