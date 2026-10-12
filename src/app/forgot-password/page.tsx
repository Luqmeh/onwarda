import { OnwardaWordmark } from "@/components/brand/onwarda-wordmark";
import { PasswordRecoveryForm } from "@/components/auth/password-recovery-form";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { LocaleFrame } from "@/components/i18n/locale-frame";
import { clientMetadata } from "@/i18n/page-title";
import { ONWARDA_TAGLINE } from "@/config/brand";

export async function generateMetadata() {
  return clientMetadata((messages) => ({
    title: messages.titles.resetPassword,
    description: messages.titles.resetPasswordDescription,
  }));
}

export default function ForgotPasswordPage() {
  return (
    <LocaleFrame>
    <main className="onwarda-client flex min-h-svh items-center justify-center px-6">
      <div className="w-full max-w-md rounded-[var(--onwarda-radius)] border bg-onwarda-white p-8 shadow-onwarda">
        <div className="mb-6 flex justify-end"><LanguageSwitcher /></div>
        <OnwardaWordmark className="mb-2 block" />
        <p className="onwarda-kicker mb-8">{ONWARDA_TAGLINE}</p>
        <PasswordRecoveryForm audience="client" />
      </div>
    </main>
    </LocaleFrame>
  );
}
