import { redirect } from "next/navigation";

import { OnwardaWordmark } from "@/components/brand/onwarda-wordmark";
import { InviteSessionGate } from "@/components/onboarding/invite-session";
import {
  BrandingStep,
  BusinessStep,
  GuidesStep,
  OperationsStep,
  PasswordStep,
  PropertyStep,
} from "@/components/onboarding/onboarding-forms";
import { Button } from "@/components/ui/button";
import { ADMIN_ROUTES } from "@/config/admin";
import { CLIENT_ROUTES } from "@/config/client";
import { createSupabaseServerClient } from "@/lib/database/server";
import { acceptClientInvitation, continueOnboardingAction, finishOnboardingAction } from "@/lib/onboarding/actions";
import { loadOnboardingSnapshot } from "@/lib/onboarding/load";
import { ONBOARDING_STEPS, onboardingProgress } from "@/lib/onboarding/steps";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Welcome",
};

const COPY: Record<string, { title: string; body: string }> = {
  welcome: {
    title: "Welcome to Onwarda",
    body: "Let's get your hospitality workspace ready. Start by choosing the password you will use to come back.",
  },
  business: {
    title: "Your business",
    body: "This is the name your team and guests will recognize.",
  },
  branding: {
    title: "Make Onwarda feel like your business",
    body: "Colors and a welcome line are enough for now. You can add a logo from Settings later.",
  },
  properties: {
    title: "The homes you host",
    body: "Add one property, or several. Details, amenities, house rules, and arrival notes stay with each home.",
  },
  guides: {
    title: "Guides guests can follow",
    body: "A short note about the washer, the television, or the neighborhood is enough to begin.",
  },
  operations: {
    title: "How the stay runs",
    body: "Cleaning, a first reservation, and what guests will see. All of this can wait.",
  },
  review: {
    title: "Your workspace is ready",
    body: "Required pieces are marked. Everything else can be finished after you go in.",
  },
};

export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <InviteSessionGate />;
  }

  const accepted = await acceptClientInvitation();

  if (accepted.status === "admin") {
    redirect(ADMIN_ROUTES.clients);
  }

  if (accepted.status !== "ok") {
    return (
      <main className="onwarda-client flex min-h-svh items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-medium">This invitation is not available</h1>
          <p className="mt-3 text-sm leading-relaxed text-onwarda-muted">
            Sign in with the email that was invited, or ask your host to send a new invitation.
          </p>
        </div>
      </main>
    );
  }

  const needsPassword = Boolean(accepted.wasInvited) || user.user_metadata?.onwarda_password_ready === false;

  if (accepted.onboardingStatus === "completed" && !needsPassword) {
    redirect(CLIENT_ROUTES.root);
  }

  const snapshot = await loadOnboardingSnapshot(needsPassword);
  const step = snapshot.step;
  const progress = onboardingProgress(step);
  const copy = COPY[step] ?? COPY.welcome;

  return (
    <main className="onwarda-client min-h-svh px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <OnwardaWordmark className="opacity-80" />
        <p className="onwarda-kicker mt-8">{snapshot.organizationName}</p>
        <h1 className="onwarda-display mt-3">{copy.title}</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-onwarda-muted">{copy.body}</p>
        <ol className="mt-8 flex gap-2" aria-label="Setup progress">
          {ONBOARDING_STEPS.map((item, index) => (
            <li
              key={item.id}
              className="h-1.5 flex-1 rounded-full"
              style={{
                background: index <= progress.index ? "var(--onwarda-olive)" : "color-mix(in srgb, var(--onwarda-olive) 18%, white)",
              }}
              aria-current={item.id === step ? "step" : undefined}
            >
              <span className="sr-only">{item.label}</span>
            </li>
          ))}
        </ol>
        <section className="client-surface mt-6 p-6 sm:p-8">
          {step === "welcome" && needsPassword ? (
            <PasswordStep email={snapshot.email} organizationName={snapshot.organizationName} />
          ) : null}
          {step === "welcome" && !needsPassword ? (
            <form action={continueOnboardingAction.bind(null, "welcome")}>
              <Button type="submit">Continue</Button>
            </form>
          ) : null}
          {step === "business" ? <BusinessStep snapshot={snapshot} /> : null}
          {step === "branding" ? <BrandingStep snapshot={snapshot} /> : null}
          {step === "properties" ? <PropertyStep snapshot={snapshot} /> : null}
          {step === "guides" ? <GuidesStep snapshot={snapshot} /> : null}
          {step === "operations" ? <OperationsStep snapshot={snapshot} /> : null}
          {step === "review" ? (
            <div className="space-y-5">
              <ul className="space-y-2 text-sm">
                {snapshot.checklist.map((item) => (
                  <li key={item.label} className="flex items-center justify-between gap-3">
                    <span>{item.label}</span>
                    <span className="text-onwarda-muted">
                      {item.done ? "Ready" : item.optional ? "Optional" : "Needs attention"}
                    </span>
                  </li>
                ))}
              </ul>
              <form action={finishOnboardingAction}>
                <Button type="submit">Finish setup</Button>
              </form>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
