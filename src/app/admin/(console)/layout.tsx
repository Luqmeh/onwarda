import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { AdminUnauthorized } from "@/components/admin/admin-unauthorized";
import { ADMIN_ROUTES, safeAdminPath } from "@/config/admin";
import { getPlatformAdminMfaGate } from "@/lib/authorization/platform-admin";
import { getActiveSupportSession } from "@/lib/admin/support";
import { AuthorizationError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export default async function AdminConsoleLayout({
  children,
}: {
  children: ReactNode;
}) {
  let admin;
  let denied = false;

  try {
    const gate = await getPlatformAdminMfaGate();
    const requested = safeAdminPath((await headers()).get("x-onwarda-pathname") ?? undefined);

    if (gate.status === "unauthenticated") {
      redirect(`${ADMIN_ROUTES.login}?next=${encodeURIComponent(requested)}`);
    }

    if (gate.status === "denied") {
      denied = true;
    } else if (gate.status === "enroll") {
      redirect(`${ADMIN_ROUTES.mfaSetup}?next=${encodeURIComponent(requested)}`);
    } else if (gate.status === "challenge") {
      redirect(`${ADMIN_ROUTES.mfaChallenge}?next=${encodeURIComponent(requested)}`);
    } else {
      admin = gate.context;
    }
  } catch (error) {
    if (error instanceof AuthorizationError) {
      denied = true;
    } else {
      throw error;
    }
  }

  if (denied || !admin) {
    return <AdminUnauthorized />;
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
