"use client";

import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ADMIN_ROUTES } from "@/config/admin";
import { useI18n } from "@/i18n/provider";
import { signOutAction } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

type AdminUserMenuProps = {
  email: string;
  role: string;
};

export function AdminUserMenu({ email, role }: AdminUserMenuProps) {
  const { messages } = useI18n();
  const signOut = signOutAction.bind(null, ADMIN_ROUTES.login);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={messages.shell.adminAccountMenu}
        className={cn(buttonVariants({ variant: "outline" }), "max-w-64")}
      >
        <span className="truncate">{email}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="space-y-1 font-normal">
          <p className="truncate text-sm font-medium text-foreground"><bdi>{email}</bdi></p>
          <p className="text-xs text-muted-foreground">{messages.shell.platformAdmin} · {role}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Link href={ADMIN_ROUTES.settings} className="flex w-full">
            {messages.nav.settings}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={signOut}>
          <Button
            type="submit"
            variant="ghost"
            className="h-8 w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            {messages.auth.signOut}
          </Button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
