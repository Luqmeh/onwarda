import { PasswordRecoveryForm } from "@/components/auth/password-recovery-form";
import { LocaleFrame } from "@/components/i18n/locale-frame";
import { APP_NAME } from "@/config/app";
import { getMessages } from "@/i18n/get-messages";

export const metadata = {
  title: "Reset administrator password",
};

export default async function AdminForgotPasswordPage() {
  const messages = getMessages("en");

  return (
    <LocaleFrame locale="en">
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-6">
      <p className="mb-6 text-xs font-medium text-muted-foreground">
        {APP_NAME} {messages.shell.internalAdmin}
      </p>
      <PasswordRecoveryForm audience="admin" />
    </main>
    </LocaleFrame>
  );
}
