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
import { signOutAction } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

type AdminUserMenuProps = {
  email: string;
  role: string;
};

export function AdminUserMenu({ email, role }: AdminUserMenuProps) {
  const signOut = signOutAction.bind(null, ADMIN_ROUTES.login);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Admin account menu"
        className={cn(buttonVariants({ variant: "outline" }), "max-w-64")}
      >
        <span className="truncate">{email}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="space-y-1 font-normal">
          <p className="truncate text-sm font-medium text-foreground">{email}</p>
          <p className="text-xs text-muted-foreground">Platform admin · {role}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Link href={ADMIN_ROUTES.settings} className="flex w-full">
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={signOut}>
          <Button
            type="submit"
            variant="ghost"
            className="h-8 w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            Sign out
          </Button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
