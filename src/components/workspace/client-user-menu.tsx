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
import { CLIENT_LOGIN, CLIENT_ROUTES } from "@/config/client";
import { useI18n } from "@/i18n/provider";
import { signOutAction } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

type ClientUserMenuProps = {
  email: string;
  name: string | null;
  organizationName: string;
  role: string;
  canManageSettings: boolean;
};

export function ClientUserMenu({
  email,
  name,
  organizationName,
  role,
  canManageSettings,
}: ClientUserMenuProps) {
  const { messages } = useI18n();
  const signOut = signOutAction.bind(null, CLIENT_LOGIN);
  const roleLabel = messages.roles[role as keyof typeof messages.roles] ?? role;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={messages.shell.accountMenu}
        className={cn(buttonVariants({ variant: "outline" }), "max-w-56")}
      >
        <span className="truncate"><bdi>{name || email}</bdi></span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="space-y-1 font-normal">
          <p className="truncate text-sm font-medium text-foreground">{name || email}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
          <p className="text-xs text-muted-foreground">
            <bdi>{organizationName}</bdi> · {roleLabel}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Link href={CLIENT_ROUTES.account} className="flex w-full">
            {messages.nav.account}
          </Link>
        </DropdownMenuItem>
        {canManageSettings ? (
          <DropdownMenuItem>
            <Link href={CLIENT_ROUTES.settings} className="flex w-full">
              {messages.nav.settings}
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <form action={signOut}>
          <Button type="submit" variant="ghost" className="h-8 w-full justify-start">
            {messages.auth.signOut}
          </Button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
