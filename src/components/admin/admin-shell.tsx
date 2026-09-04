import type { ReactNode } from "react";
import Link from "next/link";

import { AdminMobileNav } from "@/components/admin/admin-mobile-nav";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminUserMenu } from "@/components/admin/admin-user-menu";
import { SupportModeBanner } from "@/components/admin/support-mode-banner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ADMIN_ROUTES } from "@/config/admin";
import { APP_NAME } from "@/config/app";
import { signOutAction } from "@/lib/auth/actions";
import type { ActiveSupportSession } from "@/lib/admin/support";

type AdminShellProps = {
  email: string;
  role: string;
  supportSession?: ActiveSupportSession | null;
  children: ReactNode;
};

export function AdminShell({
  email,
  role,
  supportSession,
  children,
}: AdminShellProps) {
  const signOut = signOutAction.bind(null, ADMIN_ROUTES.login);

  return (
    <div className="min-h-svh bg-background">
      {supportSession ? <SupportModeBanner session={supportSession} /> : null}
      <header className="sticky top-0 z-30 border-b bg-background">
        <div className="relative flex h-14 items-center justify-between gap-3 px-4 md:px-6">
          <div className="flex items-center gap-3">
            <AdminMobileNav />
            <Link href={ADMIN_ROUTES.root} className="font-semibold tracking-tight">
              {APP_NAME}
            </Link>
            <span className="hidden text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase sm:inline">
              Internal Admin
            </span>
          </div>
          <AdminUserMenu email={email} role={role} />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl">
        <aside className="sticky top-14 hidden h-[calc(100svh-3.5rem)] w-56 shrink-0 border-e md:flex md:flex-col">
          <div className="flex-1 p-4">
            <AdminNav />
          </div>
          <Separator />
          <form action={signOut} className="p-4">
            <Button type="submit" variant="ghost" className="w-full justify-start">
              Sign out
            </Button>
          </form>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
