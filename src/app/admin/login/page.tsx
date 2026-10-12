import { LocaleFrame } from "@/components/i18n/locale-frame";
import { SignInForm } from "@/features/auth/sign-in-form";
import { ADMIN_ROUTES } from "@/config/admin";
import { APP_NAME } from "@/config/app";
import { getMessages } from "@/i18n/get-messages";
import { ADMIN_FORGOT_PASSWORD_PATH } from "@/lib/auth/password-recovery";

export const metadata = {
  title: "Admin sign in",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const messages = getMessages("en");
  const nextPath =
    typeof params.next === "string" && params.next.startsWith("/admin")
      ? params.next
      : ADMIN_ROUTES.root;

  return (
    <LocaleFrame locale="en">
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-6">
      <p className="mb-6 text-xs font-medium text-muted-foreground">
        {APP_NAME} {messages.shell.internalAdmin}
      </p>
      <SignInForm
        nextPath={nextPath}
        title={messages.auth.signIn}
        description={messages.auth.adminSignInDescription}
        recoveryHref={ADMIN_FORGOT_PASSWORD_PATH}
      />
    </main>
    </LocaleFrame>
  );
}
