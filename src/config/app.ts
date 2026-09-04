export const APP_NAME = "Onwarda";

export const DEFAULT_APP_URL = "http://localhost:3000";

export const DEFAULT_LOCALE = "en" as const;

export const RTL_LOCALES = ["ar"] as const;

export const RESERVED_ORGANIZATION_SLUGS = [
  "admin",
  "app",
  "api",
  "auth",
  "g",
  "guest",
  "login",
  "logout",
  "o",
  "onwarda",
  "settings",
  "status",
  "support",
  "www",
] as const;

export const CLIENT_ACCESS_PREFIX = "/o";
export const GUEST_PORTAL_PREFIX = "/g";
export const ADMIN_PREFIX = "/admin";
export const CLIENT_WORKSPACE_PREFIX = "/app";

export function clientAccessPath(slug: string) {
  return `${CLIENT_ACCESS_PREFIX}/${slug}`;
}

export function guestPortalPath(token: string) {
  return `${GUEST_PORTAL_PREFIX}/${token}`;
}

export function joinAppUrl(appUrl: string, path: string) {
  return new URL(path, appUrl).toString();
}

export function clientAccessUrl(appUrl: string, slug: string) {
  return joinAppUrl(appUrl, clientAccessPath(slug));
}

export function guestPortalUrl(appUrl: string, token: string) {
  return joinAppUrl(appUrl, guestPortalPath(token));
}

/**
 * Hostname resolution is centralized so the app can later support:
 * - app.onwarda.com/o/{slug}
 * - {slug}.onwarda.com
 * - a customer custom domain
 *
 * The organization UUID remains the canonical identity. Slugs and hostnames
 * are routing identifiers only.
 */
export const TENANT_HOST_STRATEGY = {
  path: "path",
  subdomain: "subdomain",
  customDomain: "custom_domain",
} as const;
