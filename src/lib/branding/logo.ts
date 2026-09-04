import { organizationIdFromStoragePath } from "@/lib/storage/paths";

export const BRANDING_LOGO_MAX_BYTES = 2 * 1024 * 1024;

export const BRANDING_LOGO_EXTENSIONS = ["png", "jpg", "jpeg", "webp"] as const;

export type BrandingLogoExtension = (typeof BRANDING_LOGO_EXTENSIONS)[number];

const LOGO_PATH =
  /^organizations\/[0-9a-fA-F-]{36}\/branding\/logo\.(png|jpg|jpeg|webp)$/;

const MAGIC: Record<BrandingLogoExtension, (bytes: Uint8Array) => boolean> = {
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

const MIME_BY_EXTENSION: Record<BrandingLogoExtension, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export function brandingLogoPath(
  organizationId: string,
  extension: BrandingLogoExtension,
) {
  return `organizations/${organizationId}/branding/logo.${extension}`;
}

export function isBrandingLogoPath(path: string | null | undefined): path is string {
  return Boolean(path && LOGO_PATH.test(path));
}

export function brandingOrganizationIdFromLogoPath(path: string) {
  if (!isBrandingLogoPath(path)) {
    return null;
  }

  return organizationIdFromStoragePath(path);
}

export function detectBrandingLogoType(bytes: Uint8Array): {
  extension: BrandingLogoExtension;
  mime: string;
} | null {
  for (const extension of BRANDING_LOGO_EXTENSIONS) {
    if (MAGIC[extension](bytes)) {
      return { extension, mime: MIME_BY_EXTENSION[extension] };
    }
  }

  return null;
}

export function validateBrandingLogoBytes(bytes: Uint8Array) {
  if (bytes.byteLength === 0) {
    throw new Error("Choose an image file to upload.");
  }

  if (bytes.byteLength > BRANDING_LOGO_MAX_BYTES) {
    throw new Error("Logo files must be 2 MB or smaller.");
  }

  const detected = detectBrandingLogoType(bytes);

  if (!detected) {
    throw new Error("Logos must be PNG, JPEG, or WebP images.");
  }

  return detected;
}

export async function readBrandingLogoFile(file: File) {
  if (file.size > BRANDING_LOGO_MAX_BYTES) {
    throw new Error("Logo files must be 2 MB or smaller.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  return {
    bytes,
    ...validateBrandingLogoBytes(bytes),
  };
}
