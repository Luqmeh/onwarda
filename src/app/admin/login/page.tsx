import { SignInForm } from "@/features/auth/sign-in-form";
import { ADMIN_ROUTES } from "@/config/admin";
import { APP_NAME } from "@/config/app";
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
  const nextPath =
    typeof params.next === "string" && params.next.startsWith("/admin")
      ? params.next
      : ADMIN_ROUTES.root;

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-6">
      <p className="mb-6 text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
        {APP_NAME} Internal Admin
      </p>
      <SignInForm
        nextPath={nextPath}
        title="Sign in"
        description="Platform administrators only. Client users cannot access this environment."
        recoveryHref={ADMIN_FORGOT_PASSWORD_PATH}
      />
    </main>
  );
}
