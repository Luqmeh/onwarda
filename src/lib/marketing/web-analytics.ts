import { MARKETING_ROUTES } from "@/config/marketing";

const PUBLIC_MARKETING_PATHS = new Set<string>(
  Object.values(MARKETING_ROUTES).filter((path) => path !== MARKETING_ROUTES.login),
);

export function publicMarketingPath(url: string): string | null {
  let pathname: string;
  try {
    pathname = new URL(url, "https://onwarda.local").pathname;
  } catch {
    return null;
  }

  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }

  return PUBLIC_MARKETING_PATHS.has(pathname) ? pathname : null;
}
