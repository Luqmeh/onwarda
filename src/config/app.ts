export const APP_NAME = "Onwarda";

export const DEFAULT_APP_URL = "http://localhost:3000";

export const DEFAULT_LOCALE = "en" as const;

export const RTL_LOCALES = ["ar"] as const;

export const RESERVED_ORGANIZATION_SLUGS = [
  "about",
  "admin",
  "app",
  "api",
  "auth",
  "contact",
  "demo",
  "faq",
  "features",
  "g",
  "guest",
  "guest-experience",
  "login",
  "logout",
  "o",
  "onwarda",
  "operations",
  "p",
  "portfolio",
  "pricing",
  "privacy",
  "product",
  "property-experience",
  "services",
  "settings",
  "signup",
  "solutions",
  "status",
  "support",
  "terms",
  "www",
] as const;

export const CLIENT_ACCESS_PREFIX = "/o";
export const GUEST_PORTAL_PREFIX = "/g";
export const CLEANER_PROFILE_PREFIX = "/cleaner";
export const PUBLIC_PORTFOLIO_PREFIX = "/p";
export const ADMIN_PREFIX = "/admin";
export const CLIENT_WORKSPACE_PREFIX = "/app";

export function clientAccessPath(slug: string) {
  return `${CLIENT_ACCESS_PREFIX}/${slug}`;
}

export function publicOperatorPath(organizationSlug: string) {
  return `${PUBLIC_PORTFOLIO_PREFIX}/${organizationSlug}`;
}

export function publicPropertyPath(organizationSlug: string, propertySlug: string) {
  return `${PUBLIC_PORTFOLIO_PREFIX}/${organizationSlug}/${propertySlug}`;
}

export function guestPortalPath(token: string, suffix = "") {
  const base = `${GUEST_PORTAL_PREFIX}/${token}`;
  return suffix ? `${base}${suffix.startsWith("/") ? suffix : `/${suffix}`}` : base;
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

export function cleanerProfilePath(token: string) {
  return `${CLEANER_PROFILE_PREFIX}/${token}`;
}

export function cleanerProfileUrl(appUrl: string, token: string) {
  return joinAppUrl(appUrl, cleanerProfilePath(token));
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
