import { redirect } from "next/navigation";

import { MfaSetupForm } from "@/components/admin/mfa-setup-form";
import { LocaleFrame } from "@/components/i18n/locale-frame";
import { AdminUnauthorized } from "@/components/admin/admin-unauthorized";
import { ADMIN_ROUTES, safeAdminPath } from "@/config/admin";
import { APP_NAME } from "@/config/app";
import { getPlatformAdminMfaGate } from "@/lib/authorization/platform-admin";

export const metadata = {
  title: "Set up authenticator",
};

export default async function AdminMfaSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safeAdminPath(params.next);
  const gate = await getPlatformAdminMfaGate();

  if (gate.status === "unauthenticated") {
    redirect(`${ADMIN_ROUTES.login}?next=${encodeURIComponent(ADMIN_ROUTES.mfaSetup)}`);
  }

  if (gate.status === "denied") {
    return <AdminUnauthorized />;
  }

  if (gate.status === "challenge") {
    redirect(`${ADMIN_ROUTES.mfaChallenge}?next=${encodeURIComponent(nextPath)}`);
  }

  if (gate.status === "ready") {
    redirect(nextPath);
  }

  return (
    <LocaleFrame locale="en">
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-6 py-10">
      <p className="mb-6 text-xs font-medium text-muted-foreground">
        {APP_NAME}
      </p>
      <MfaSetupForm nextPath={nextPath} />
    </main>
    </LocaleFrame>
  );
}
