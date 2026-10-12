import { OnwardaWordmark } from "@/components/brand/onwarda-wordmark";
import { PasswordRecoveryForm } from "@/components/auth/password-recovery-form";
import { ONWARDA_TAGLINE } from "@/config/brand";

export const metadata = {
  title: "Reset password",
  description: "Request a password recovery code for your Onwarda account.",
};

export default function ForgotPasswordPage() {
  return (
    <main className="onwarda-client flex min-h-svh items-center justify-center px-6">
      <div className="w-full max-w-md rounded-[var(--onwarda-radius)] border bg-onwarda-white p-8 shadow-onwarda">
        <OnwardaWordmark className="mb-2 block" />
        <p className="onwarda-kicker mb-8">{ONWARDA_TAGLINE}</p>
        <PasswordRecoveryForm audience="client" />
      </div>
    </main>
  );
}
