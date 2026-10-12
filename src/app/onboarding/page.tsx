import { redirect } from "next/navigation";

import { OnwardaWordmark } from "@/components/brand/onwarda-wordmark";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { LocaleFrame } from "@/components/i18n/locale-frame";
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
import { getRequestI18n } from "@/i18n/get-locale";
import { clientMetadata } from "@/i18n/page-title";
import { createSupabaseServerClient } from "@/lib/database/server";
import { acceptClientInvitation, continueOnboardingAction, finishOnboardingAction } from "@/lib/onboarding/actions";
import { loadOnboardingSnapshot } from "@/lib/onboarding/load";
import { ONBOARDING_STEPS, onboardingProgress, type OnboardingStepId } from "@/lib/onboarding/steps";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return clientMetadata((messages) => ({ title: messages.titles.onboarding }));
}

export default async function OnboardingPage() {
  const { messages } = await getRequestI18n();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <LocaleFrame>
        <div className="absolute end-4 top-4">
          <LanguageSwitcher />
        </div>
        <InviteSessionGate />
      </LocaleFrame>
    );
  }

  const accepted = await acceptClientInvitation();

  if (accepted.status === "admin") {
    redirect(ADMIN_ROUTES.clients);
  }

  if (accepted.status !== "ok") {
    return (
      <LocaleFrame>
        <main className="onwarda-client flex min-h-svh items-center justify-center px-6">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-medium">{messages.onboarding.invitationUnavailable}</h1>
            <p className="mt-3 text-sm leading-relaxed text-onwarda-muted">
              {messages.onboarding.invitationUnavailableBody}
            </p>
          </div>
        </main>
      </LocaleFrame>
    );
  }

  const needsPassword = Boolean(accepted.wasInvited) || user.user_metadata?.onwarda_password_ready === false;

  if (accepted.onboardingStatus === "completed" && !needsPassword) {
    redirect(CLIENT_ROUTES.root);
  }

  const snapshot = await loadOnboardingSnapshot(needsPassword);
  const step = snapshot.step;
  const progress = onboardingProgress(step);
  const copy = onboardingCopy(step, messages.onboarding);
  const stepLabel = (id: OnboardingStepId) =>
    ({
      welcome: messages.onboarding.stepWelcome,
      business: messages.onboarding.stepBusiness,
      branding: messages.onboarding.stepBranding,
      properties: messages.onboarding.stepProperties,
      guides: messages.onboarding.stepGuides,
      operations: messages.onboarding.stepOperations,
      review: messages.onboarding.stepReview,
    })[id];
  const checklistLabel = {
    business: messages.onboarding.checklistBusiness,
    branding: messages.onboarding.checklistBranding,
    property: messages.onboarding.checklistProperty,
    guide: messages.onboarding.checklistGuide,
    cleaner: messages.onboarding.checklistCleaner,
  };

  return (
    <LocaleFrame>
      <main className="onwarda-client min-h-svh px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-start justify-between gap-4">
            <OnwardaWordmark className="opacity-80" />
            <LanguageSwitcher />
          </div>
          <p className="onwarda-kicker mt-8">{snapshot.organizationName}</p>
          <h1 className="onwarda-display mt-3">{copy.title}</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-onwarda-muted">{copy.body}</p>
          <ol className="mt-8 flex gap-2" aria-label={messages.onboarding.setupProgress}>
            {ONBOARDING_STEPS.map((item, index) => (
              <li
                key={item.id}
                className="h-1.5 flex-1 rounded-full"
                style={{
                  background: index <= progress.index ? "var(--onwarda-olive)" : "color-mix(in srgb, var(--onwarda-olive) 18%, white)",
                }}
                aria-current={item.id === step ? "step" : undefined}
              >
                <span className="sr-only">{stepLabel(item.id)}</span>
              </li>
            ))}
          </ol>
          <section className="client-surface mt-6 p-6 sm:p-8">
            {step === "welcome" && needsPassword ? (
              <PasswordStep email={snapshot.email} organizationName={snapshot.organizationName} />
            ) : null}
            {step === "welcome" && !needsPassword ? (
              <form action={continueOnboardingAction.bind(null, "welcome")}>
                <Button type="submit">{messages.auth.continue}</Button>
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
                    <li key={item.key} className="flex items-center justify-between gap-3">
                      <span>{checklistLabel[item.key]}</span>
                      <span className="text-onwarda-muted">
                        {item.done
                          ? messages.catalog.ready
                          : item.optional
                            ? messages.actions.optional
                            : messages.onboarding.needsAttention}
                      </span>
                    </li>
                  ))}
                </ul>
                <form action={finishOnboardingAction}>
                  <Button type="submit">{messages.onboarding.finishSetup}</Button>
                </form>
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </LocaleFrame>
  );
}

function onboardingCopy(
  step: OnboardingStepId,
  copy: {
    welcomeTitle: string;
    welcomeBody: string;
    businessTitle: string;
    businessBody: string;
    brandingTitle: string;
    brandingBody: string;
    propertiesTitle: string;
    propertiesBody: string;
    guidesTitle: string;
    guidesBody: string;
    operationsTitle: string;
    operationsBody: string;
    reviewTitle: string;
    reviewBody: string;
  },
) {
  const byStep = {
    welcome: { title: copy.welcomeTitle, body: copy.welcomeBody },
    business: { title: copy.businessTitle, body: copy.businessBody },
    branding: { title: copy.brandingTitle, body: copy.brandingBody },
    properties: { title: copy.propertiesTitle, body: copy.propertiesBody },
    guides: { title: copy.guidesTitle, body: copy.guidesBody },
    operations: { title: copy.operationsTitle, body: copy.operationsBody },
    review: { title: copy.reviewTitle, body: copy.reviewBody },
  };
  return byStep[step];
}
