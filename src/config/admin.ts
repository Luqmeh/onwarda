export const ADMIN_ROUTES = {
  root: "/admin",
  login: "/admin/login",
  clients: "/admin/clients",
  clientNew: "/admin/clients/new",
  activity: "/admin/activity",
  settings: "/admin/settings",
  mfaSetup: "/admin/security/mfa-setup",
  mfaChallenge: "/admin/security/mfa-challenge",
  accept: "/admin/accept",
} as const;

export function safeAdminPath(value: string | undefined) {
  if (
    !value ||
    !value.startsWith("/admin") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    value.includes("://") ||
    value.includes("..")
  ) {
    return ADMIN_ROUTES.root;
  }

  if (value.startsWith("/admin/login") || value.startsWith("/admin/security")) {
    return ADMIN_ROUTES.root;
  }

  return value;
}

export const ADMIN_CLIENT_PAGE_SIZE = 20;

export const SUPPORT_SESSION_COOKIE = "onwarda_support_session";
export const SUPPORT_SESSION_DURATION_MINUTES = 120;

export function adminClientPath(organizationId: string) {
  return `${ADMIN_ROUTES.clients}/${organizationId}`;
}

export const ADMIN_NAV_ITEMS = [
  { href: ADMIN_ROUTES.root, label: "Dashboard", exact: true },
  { href: ADMIN_ROUTES.clients, label: "Clients", exact: false },
  { href: ADMIN_ROUTES.activity, label: "Activity", exact: false },
  { href: ADMIN_ROUTES.settings, label: "Settings", exact: false },
] as const;

export function isAdminNavActive(pathname: string, href: string, exact: boolean) {
  if (exact) {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
