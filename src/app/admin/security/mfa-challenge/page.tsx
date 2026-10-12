import { redirect } from "next/navigation";

import { MfaChallengeForm } from "@/components/admin/mfa-challenge-form";
import { LocaleFrame } from "@/components/i18n/locale-frame";
import { AdminUnauthorized } from "@/components/admin/admin-unauthorized";
import { ADMIN_ROUTES, safeAdminPath } from "@/config/admin";
import { APP_NAME } from "@/config/app";
import { getPlatformAdminMfaGate } from "@/lib/authorization/platform-admin";

export const metadata = {
  title: "Authenticator code",
};

export default async function AdminMfaChallengePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safeAdminPath(params.next);
  const gate = await getPlatformAdminMfaGate();

  if (gate.status === "unauthenticated") {
    redirect(`${ADMIN_ROUTES.login}?next=${encodeURIComponent(nextPath)}`);
  }

  if (gate.status === "denied") {
    return <AdminUnauthorized />;
  }

  if (gate.status === "enroll") {
    redirect(`${ADMIN_ROUTES.mfaSetup}?next=${encodeURIComponent(nextPath)}`);
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
      <MfaChallengeForm nextPath={nextPath} />
    </main>
    </LocaleFrame>
  );
}
