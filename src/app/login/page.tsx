import Link from "next/link";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/shared/sign-out-button";
import { Button } from "@/components/ui/button";
import { OnwardaWordmark } from "@/components/brand/onwarda-wordmark";
import { ONWARDA_TAGLINE } from "@/config/brand";
import { CLIENT_LOGIN, CLIENT_ROUTES } from "@/config/client";
import { CLIENT_FORGOT_PASSWORD_PATH } from "@/lib/auth/password-recovery";
import { SignInForm } from "@/features/auth/sign-in-form";
import { getCurrentUser } from "@/lib/auth/session";
import { safeInternalPath } from "@/lib/auth/safe-path";
import { readOnboardingGate } from "@/lib/onboarding/load";
import { recordMarketingEvent } from "@/lib/marketing/events";
import { getCurrentOrganization } from "@/lib/tenancy/context";

export const metadata = {
  title: "Log in",
  description: "Sign in to your Onwarda workspace.",
};

export default async function ClientLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
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
      <main className="onwarda-client flex min-h-svh items-center justify-center px-6">
        <div className="w-full max-w-md rounded-[var(--onwarda-radius)] border bg-onwarda-white p-8 shadow-onwarda">
          <OnwardaWordmark className="mb-2 block" />
          <p className="onwarda-kicker mb-8">{ONWARDA_TAGLINE}</p>
          <h1 className="text-2xl font-semibold tracking-tight">You are signed in</h1>
          <p className="mt-2 text-sm leading-relaxed text-onwarda-muted">
            Signed in as {user.email ?? "your account"}. Continue to your workspace or
            sign out to use a different client account.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            {membership ? (
              <Button asChild>
                <Link href={CLIENT_ROUTES.root}>Open workspace</Link>
              </Button>
            ) : null}
            <SignOutButton redirectTo={CLIENT_LOGIN} />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="onwarda-client flex min-h-svh items-center justify-center px-6">
      <div className="w-full max-w-md rounded-[var(--onwarda-radius)] border bg-onwarda-white p-8 shadow-onwarda">
        <OnwardaWordmark className="mb-2 block" />
        <p className="onwarda-kicker mb-8">{ONWARDA_TAGLINE}</p>
        <SignInForm
          nextPath={nextPath}
          title="Welcome back"
          description="Sign in to your organization workspace."
          recoveryHref={CLIENT_FORGOT_PASSWORD_PATH}
        />
      </div>
    </main>
  );
}
