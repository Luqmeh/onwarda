import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

export const REQUIRED_STATIC_ROUTES = [
  "/",
  "/product",
  "/features",
  "/guest-experience",
  "/property-experience",
  "/operations",
  "/services",
  "/pricing",
  "/about",
  "/contact",
  "/faq",
  "/privacy",
  "/terms",
  "/signup",
  "/login",
  "/admin",
  "/admin/login",
  "/admin/clients",
  "/admin/clients/new",
  "/admin/activity",
  "/admin/settings",
  "/app",
  "/app/calendar",
  "/app/properties",
  "/app/properties/new",
  "/app/reservations",
  "/app/reservations/new",
  "/app/guests",
  "/app/issues",
  "/app/cleaning",
  "/app/cleaning/agents",
  "/app/knowledge",
  "/app/settings",
  "/app/billing",
  "/app/account",
] as const;

export const REQUIRED_DYNAMIC_ROUTES = [
  "/admin/clients/[organizationId]",
  "/app/properties/[propertyId]",
  "/app/reservations/[reservationId]",
  "/app/guests/[guestId]",
  "/app/cleaning/[cleaningTaskId]",
  "/app/cleaning/agents/[cleaningAgentId]",
  "/cleaner/[token]",
  "/cleaner/[token]/task/[taskId]",
  "/o/[slug]",
  "/p/[organizationSlug]",
  "/p/[organizationSlug]/[propertySlug]",
  "/g/[token]",
  "/g/[token]/onboarding",
  "/g/[token]/arrival",
  "/g/[token]/wifi",
  "/g/[token]/rules",
  "/g/[token]/property",
  "/g/[token]/guides",
  "/g/[token]/support",
  "/g/[token]/checkout",
] as const;

export function appPagesDirectory(cwd = process.cwd()) {
  return join(cwd, "src", "app");
}

export function toAppRoute(filePath: string, appDir: string) {
  const relativePath = relative(appDir, filePath).split(sep).join("/");
  const withoutFile = relativePath.replace(/\/page\.tsx$/, "").replace(/^page\.tsx$/, "");
  const segments = withoutFile
    .split("/")
    .filter((segment) => segment.length > 0 && !/^\(.+\)$/.test(segment));

  return segments.length === 0 ? "/" : `/${segments.join("/")}`;
}

export function listAppPageRoutes(cwd = process.cwd()) {
  const appDir = appPagesDirectory(cwd);
  const pages: string[] = [];

  function walk(directory: string) {
    for (const entry of readdirSync(directory)) {
      const fullPath = join(directory, entry);
      if (statSync(fullPath).isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (entry === "page.tsx") {
        pages.push(toAppRoute(fullPath, appDir));
      }
    }
  }

  walk(appDir);
  return pages.sort();
}

export function listCatchAllRoutes(cwd = process.cwd()) {
  return listAppPageRoutes(cwd).filter((route) => route.includes("[..."));
}
