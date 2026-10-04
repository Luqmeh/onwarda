import {
  EXTERNAL_MEDIA_HOSTS,
  PROPERTY_MEDIA_TYPES,
  type PropertyMediaType,
} from "@/lib/property-cms/catalog";

const BLOCKED_SCHEMES = ["javascript:", "data:", "file:", "vbscript:"];

export function parseHttpsUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const lower = trimmed.toLowerCase();

  if (BLOCKED_SCHEMES.some((scheme) => lower.startsWith(scheme))) {
    return null;
  }

  if (trimmed.includes("<") || trimmed.includes(">") || /iframe/i.test(trimmed)) {
    return null;
  }

  try {
    const url = new URL(trimmed);

    if (url.protocol !== "https:") {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

export function allowedHostsForMediaType(mediaType: PropertyMediaType) {
  if (mediaType === PROPERTY_MEDIA_TYPES.VIDEO) {
    return EXTERNAL_MEDIA_HOSTS.video;
  }

  if (mediaType === PROPERTY_MEDIA_TYPES.TOUR_360) {
    return EXTERNAL_MEDIA_HOSTS.tour_360;
  }

  if (mediaType === PROPERTY_MEDIA_TYPES.INSTRUCTIONAL_VIDEO) {
    return EXTERNAL_MEDIA_HOSTS.instructional_video;
  }

  return [];
}

export function isAllowedExternalMediaUrl(
  value: string,
  mediaType: Exclude<PropertyMediaType, "image">,
) {
  const url = parseHttpsUrl(value);

  if (!url) {
    return false;
  }

  const host = url.hostname.toLowerCase();
  return (allowedHostsForMediaType(mediaType) as readonly string[]).includes(host);
}

export function normalizeExternalMediaUrl(
  value: string,
  mediaType: Exclude<PropertyMediaType, "image">,
) {
  if (!isAllowedExternalMediaUrl(value, mediaType)) {
    return null;
  }

  const url = parseHttpsUrl(value);

  if (!url) {
    return null;
  }

  url.hash = "";
  return url.toString();
}
