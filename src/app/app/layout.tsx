import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { ClientShell } from "@/components/workspace/client-shell";
import { ClientUnavailable } from "@/components/workspace/client-unavailable";
import { ADMIN_ROUTES } from "@/config/admin";
import { CLIENT_LOGIN } from "@/config/client";
import { getPlatformAdminContext } from "@/lib/authorization/platform-admin";
import { resolveValidSupportWorkspace } from "@/lib/authorization/support-workspace";
import { AuthenticationError, AuthorizationError } from "@/lib/errors";
import { loadWorkspaceBranding } from "@/lib/branding/load";
import { readOnboardingGate } from "@/lib/onboarding/load";
import { requireCurrentOrganization } from "@/lib/tenancy/context";
import type { WorkspaceView } from "@/types/auth";

export const dynamic = "force-dynamic";

export default async function ClientWorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  let view: WorkspaceView;

  try {
    view = {
      kind: "membership",
      context: await requireCurrentOrganization(),
    };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      redirect(CLIENT_LOGIN);
    }

    if (error instanceof AuthorizationError) {
      const support = await resolveValidSupportWorkspace();

      if (support) {
        view = { kind: "support", context: support };
      } else {
        const admin = await getPlatformAdminContext();

        if (admin) {
          return (
            <ClientUnavailable
              title="This is a client workspace."
              description="You're currently signed in as an Onwarda Internal Admin. Use Support Mode from the Internal Admin to access a client workspace for troubleshooting."
              actionHref={ADMIN_ROUTES.clients}
              actionLabel="Back to clients"
            />
          );
        }

        return (
          <ClientUnavailable
            title="Workspace unavailable"
            description={error.message}
          />
        );
      }
    } else {
      throw error;
    }
  }

  if (
    view.kind === "membership" &&
    (view.context.membership.role === "owner" || view.context.membership.role === "admin")
  ) {
    const onboarding = await readOnboardingGate();

    if (onboarding.status && onboarding.status !== "completed") {
      redirect("/onboarding");
    }
  }

  const branding = await loadWorkspaceBranding(view);

  return (
    <ClientShell view={view} branding={branding}>
      {children}
    </ClientShell>
  );
}
