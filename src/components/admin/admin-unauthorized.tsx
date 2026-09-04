import { StatusPanel } from "@/components/shared/status-panel";
import { SignOutButton } from "@/components/shared/sign-out-button";
import { ADMIN_ROUTES } from "@/config/admin";

export function AdminUnauthorized() {
  return (
    <main className="mx-auto flex min-h-svh max-w-xl items-center px-6">
      <StatusPanel
        title="Access denied"
        description="This environment is reserved for Onwarda platform administrators. Client users cannot access /admin."
      >
        <SignOutButton redirectTo={ADMIN_ROUTES.login} />
      </StatusPanel>
    </main>
  );
}
