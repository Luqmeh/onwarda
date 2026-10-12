import { PasswordRecoveryForm } from "@/components/auth/password-recovery-form";
import { APP_NAME } from "@/config/app";

export const metadata = {
  title: "Reset administrator password",
};

export default function AdminForgotPasswordPage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-6">
      <p className="mb-6 text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
        {APP_NAME} Internal Admin
      </p>
      <PasswordRecoveryForm audience="admin" />
    </main>
  );
}
