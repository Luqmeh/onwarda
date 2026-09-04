import {
  ORGANIZATION_ADMIN_ROLES,
  ORGANIZATION_ISSUE_WRITE_ROLES,
  ORGANIZATION_OPERATIONAL_ROLES,
} from "@/lib/authorization/roles";
import { CLIENT_WORKSPACE_PREFIX } from "@/config/app";
import type { OrganizationUserRole } from "@/types/enums";

export const CLIENT_ROUTES = {
  root: CLIENT_WORKSPACE_PREFIX,
  properties: `${CLIENT_WORKSPACE_PREFIX}/properties`,
  propertyNew: `${CLIENT_WORKSPACE_PREFIX}/properties/new`,
  reservations: `${CLIENT_WORKSPACE_PREFIX}/reservations`,
  reservationNew: `${CLIENT_WORKSPACE_PREFIX}/reservations/new`,
  guests: `${CLIENT_WORKSPACE_PREFIX}/guests`,
  issues: `${CLIENT_WORKSPACE_PREFIX}/issues`,
  knowledge: `${CLIENT_WORKSPACE_PREFIX}/knowledge`,
  settings: `${CLIENT_WORKSPACE_PREFIX}/settings`,
  account: `${CLIENT_WORKSPACE_PREFIX}/account`,
} as const;

export const CLIENT_LOGIN = "/login";

const ALL_ROLES: OrganizationUserRole[] = [
  "owner",
  "admin",
  "manager",
  "staff",
];

export const CLIENT_NAV_ITEMS = [
  { href: CLIENT_ROUTES.root, label: "Overview", exact: true, roles: ALL_ROLES },
  {
    href: CLIENT_ROUTES.properties,
    label: "Properties",
    exact: false,
    roles: ALL_ROLES,
  },
  {
    href: CLIENT_ROUTES.reservations,
    label: "Reservations",
    exact: false,
    roles: ALL_ROLES,
  },
  { href: CLIENT_ROUTES.guests, label: "Guests", exact: false, roles: ALL_ROLES },
  { href: CLIENT_ROUTES.issues, label: "Issues", exact: false, roles: ALL_ROLES },
  {
    href: CLIENT_ROUTES.knowledge,
    label: "Knowledge",
    exact: false,
    roles: ALL_ROLES,
  },
  {
    href: CLIENT_ROUTES.settings,
    label: "Settings",
    exact: false,
    roles: ORGANIZATION_ADMIN_ROLES,
  },
] as const;

export function isClientNavActive(pathname: string, href: string, exact: boolean) {
  if (exact) {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export type ClientNavItem = (typeof CLIENT_NAV_ITEMS)[number];

export function clientNavItemsForRole(role: OrganizationUserRole): ClientNavItem[] {
  return CLIENT_NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function canManageWorkspace(role: OrganizationUserRole) {
  return ORGANIZATION_ADMIN_ROLES.includes(role);
}

export function canWriteIssues(role: OrganizationUserRole) {
  return ORGANIZATION_ISSUE_WRITE_ROLES.includes(role);
}

export function canManageStays(role: OrganizationUserRole) {
  return ORGANIZATION_OPERATIONAL_ROLES.includes(role);
}

export function clientPropertyPath(propertyId: string) {
  return `${CLIENT_ROUTES.properties}/${propertyId}`;
}

export function clientReservationPath(reservationId: string) {
  return `${CLIENT_ROUTES.reservations}/${reservationId}`;
}

export function clientGuestPath(guestId: string) {
  return `${CLIENT_ROUTES.guests}/${guestId}`;
}

export function clientReservationCreatePath(propertyId?: string) {
  if (!propertyId) {
    return CLIENT_ROUTES.reservationNew;
  }

  return `${CLIENT_ROUTES.reservationNew}?property=${propertyId}`;
}
