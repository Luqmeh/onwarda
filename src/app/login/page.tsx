import Link from "next/link";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/shared/sign-out-button";
import { Button } from "@/components/ui/button";
import { OnwardaWordmark } from "@/components/brand/onwarda-wordmark";
import { ONWARDA_TAGLINE } from "@/config/brand";
import { CLIENT_LOGIN, CLIENT_ROUTES } from "@/config/client";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { LocaleFrame } from "@/components/i18n/locale-frame";
import { getRequestI18n } from "@/i18n/get-locale";
import { clientMetadata } from "@/i18n/page-title";
import { CLIENT_FORGOT_PASSWORD_PATH } from "@/lib/auth/password-recovery";
import { SignInForm } from "@/features/auth/sign-in-form";
import { getCurrentUser } from "@/lib/auth/session";
import { safeInternalPath } from "@/lib/auth/safe-path";
import { readOnboardingGate } from "@/lib/onboarding/load";
import { recordMarketingEvent } from "@/lib/marketing/events";
import { getCurrentOrganization } from "@/lib/tenancy/context";

export async function generateMetadata() {
  return clientMetadata((messages) => ({
    title: messages.titles.login,
    description: messages.titles.loginDescription,
  }));
}

export default async function ClientLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const { messages } = await getRequestI18n();
  const nextPath = safeInternalPath(params.next, CLIENT_ROUTES.root);
  const user = await getCurrentUser();

  if (!user) {
    await recordMarketingEvent({ type: "login_started", path: "/login" });
  }

  if (user) {
    const onboarding = await readOnboardingGate().catch(() => null);

    if (
      onboarding &&
      (onboarding.role === "owner" || onboarding.role === "admin") &&
      onboarding.status &&
      onboarding.status !== "completed"
    ) {
      redirect("/onboarding");
    }

    if (
      nextPath.startsWith("/signup") ||
      nextPath.startsWith("/pricing") ||
      nextPath.startsWith("/contact")
    ) {
      redirect(nextPath);
    }

    const membership = await getCurrentOrganization().catch(() => null);

    if (membership && (nextPath.startsWith("/app") || nextPath.startsWith("/o/"))) {
      redirect(nextPath.startsWith("/app") ? nextPath : CLIENT_ROUTES.root);
    }

    return (
      <LocaleFrame>
      <main className="onwarda-client flex min-h-svh items-center justify-center px-6">
        <div className="w-full max-w-md rounded-[var(--onwarda-radius)] border bg-onwarda-white p-8 shadow-onwarda">
          <OnwardaWordmark className="mb-2 block" />
          <p className="onwarda-kicker mb-8">{ONWARDA_TAGLINE}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{messages.auth.welcomeBack}</h1>
          <p className="mt-2 text-sm leading-relaxed text-onwarda-muted">
            {messages.auth.signedInAs.split("{email}")[0]}
            <bdi dir="ltr">{user.email ?? messages.shell.unknownUser}</bdi>
            {messages.auth.signedInAs.split("{email}")[1]}{" "}
            {messages.auth.continueOrSignOut}
          </p>
          <div className="mt-6 flex flex-col gap-3">
            {membership ? (
              <Button asChild>
                <Link href={CLIENT_ROUTES.root}>{messages.auth.openWorkspace}</Link>
              </Button>
            ) : null}
            <SignOutButton redirectTo={CLIENT_LOGIN} />
          </div>
        </div>
      </main>
      </LocaleFrame>
    );
  }

  return (
    <LocaleFrame>
    <main className="onwarda-client flex min-h-svh items-center justify-center px-6">
      <div className="w-full max-w-md rounded-[var(--onwarda-radius)] border bg-onwarda-white p-8 shadow-onwarda">
        <div className="mb-6 flex justify-end"><LanguageSwitcher /></div>
        <OnwardaWordmark className="mb-2 block" />
        <p className="onwarda-kicker mb-8">{ONWARDA_TAGLINE}</p>
        <SignInForm
          nextPath={nextPath}
          title={messages.auth.welcomeBack}
          description={messages.auth.clientSignInDescription}
          recoveryHref={CLIENT_FORGOT_PASSWORD_PATH}
        />
      </div>
    </main>
    </LocaleFrame>
  );
}
