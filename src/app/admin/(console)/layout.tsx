import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { AdminUnauthorized } from "@/components/admin/admin-unauthorized";
import { ADMIN_ROUTES } from "@/config/admin";
import { requirePlatformAdmin } from "@/lib/authorization/platform-admin";
import { getActiveSupportSession } from "@/lib/admin/support";
import { AuthenticationError, AuthorizationError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export default async function AdminConsoleLayout({
  children,
}: {
  children: ReactNode;
}) {
  let admin;

  try {
    admin = await requirePlatformAdmin();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      redirect(ADMIN_ROUTES.login);
    }

    if (error instanceof AuthorizationError) {
      return <AdminUnauthorized />;
    }

    throw error;
  }

  return (
    <AdminShell
      email={admin.user.email ?? admin.profile?.email ?? "Unknown user"}
      role={admin.admin.role}
      supportSession={await getActiveSupportSession()}
    >
      {children}
    </AdminShell>
  );
}
