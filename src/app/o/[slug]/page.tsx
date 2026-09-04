import Link from "next/link";
import { redirect } from "next/navigation";

import { StatusPanel } from "@/components/shared/status-panel";
import { Button } from "@/components/ui/button";
import { ADMIN_ROUTES } from "@/config/admin";
import { CLIENT_LOGIN, CLIENT_ROUTES } from "@/config/client";
import { clientAccessPath } from "@/config/app";
import { getCurrentUser } from "@/lib/auth/session";
import { safeInternalPath } from "@/lib/auth/safe-path";
import { getPlatformAdminContext } from "@/lib/authorization/platform-admin";
import { AuthenticationError, AuthorizationError } from "@/lib/errors";
import { getCurrentOrganization } from "@/lib/tenancy/context";
import { organizationSlugSchema } from "@/lib/validation/organization";
import type { OrganizationMembershipContext } from "@/types/auth";

export const metadata = {
  title: "Organization",
};

export default async function OrganizationAccessPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const parsed = organizationSlugSchema.safeParse(slug);
  const requestedPath = parsed.success ? clientAccessPath(parsed.data) : "/app";
  const returnPath = safeInternalPath(requestedPath, CLIENT_ROUTES.root);

  if (!parsed.success) {
    return (
      <main className="onwarda-client mx-auto flex min-h-svh max-w-xl items-center px-6">
        <StatusPanel
          title="Unknown organization"
          description="The requested client access path is not a valid organization slug."
        />
      </main>
    );
  }

  const user = await getCurrentUser();

  if (!user) {
    redirect(`${CLIENT_LOGIN}?next=${encodeURIComponent(returnPath)}`);
  }

  let context: OrganizationMembershipContext | null = null;
  let accessError: string | null = null;

  try {
    context = await getCurrentOrganization();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      redirect(`${CLIENT_LOGIN}?next=${encodeURIComponent(returnPath)}`);
    }

    accessError =
      error instanceof AuthorizationError
        ? error.message
        : "This client access link could not be resolved.";
  }

  if (!context) {
    const admin = await getPlatformAdminContext();

    if (admin) {
      return (
        <main className="onwarda-client mx-auto flex min-h-svh max-w-xl items-center px-6">
          <StatusPanel
            title="This is a client workspace."
            description="You're currently signed in as an Onwarda Internal Admin. Use Support Mode from the Internal Admin to access a client workspace for troubleshooting."
          >
            <Button asChild>
              <Link href={ADMIN_ROUTES.clients}>Back to clients</Link>
            </Button>
          </StatusPanel>
        </main>
      );
    }

    return (
      <main className="onwarda-client mx-auto flex min-h-svh max-w-xl items-center px-6">
        <StatusPanel
          title="Workspace unavailable"
          description={accessError ?? "An organization membership is required."}
        />
      </main>
    );
  }

  if (context.organization.slug === parsed.data) {
    redirect(CLIENT_ROUTES.root);
  }

  return (
    <main className="onwarda-client mx-auto flex min-h-svh max-w-xl items-center px-6">
      <StatusPanel
        title="Wrong organization"
        description="This client access link does not match the organization attached to your account. Organization UUIDs are not accepted from the URL."
      >
        <Button asChild>
          <Link href={CLIENT_ROUTES.root}>Open your workspace</Link>
        </Button>
      </StatusPanel>
    </main>
  );
}
