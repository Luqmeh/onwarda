import { type NextRequest, NextResponse } from "next/server";

import { ADMIN_ROUTES } from "@/config/admin";
import {
  ADMIN_PREFIX,
  CLIENT_WORKSPACE_PREFIX,
} from "@/config/app";
import { updateSession } from "@/lib/auth/proxy-session";

export function isAdminPath(pathname: string) {
  return pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`);
}

export function isClientWorkspacePath(pathname: string) {
  return (
    pathname === CLIENT_WORKSPACE_PREFIX ||
    pathname.startsWith(`${CLIENT_WORKSPACE_PREFIX}/`)
  );
}

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;
  const isAdminLogin = pathname === `${ADMIN_PREFIX}/login`;
  const isAdminAccept = pathname === ADMIN_ROUTES.accept;

  if (isAdminPath(pathname) && !isAdminLogin && !isAdminAccept && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = `${ADMIN_PREFIX}/login`;
    loginUrl.search = "";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminLogin && user) {
    const adminUrl = request.nextUrl.clone();
    adminUrl.pathname = ADMIN_PREFIX;
    adminUrl.search = "";
    return NextResponse.redirect(adminUrl);
  }

  if (isClientWorkspacePath(pathname) && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/app",
    "/app/:path*",
    "/login",
  ],
};
