"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";

import { AdminNav } from "@/components/admin/admin-nav";
import { Button } from "@/components/ui/button";
import { ADMIN_ROUTES } from "@/config/admin";
import { signOutAction } from "@/lib/auth/actions";

export function AdminMobileNav() {
  const [open, setOpen] = useState(false);
  const signOut = signOutAction.bind(null, ADMIN_ROUTES.login);

  return (
    <div className="md:hidden">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-expanded={open}
        aria-controls="admin-mobile-nav"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X className="size-4" /> : <Menu className="size-4" />}
        <span className="sr-only">Toggle navigation</span>
      </Button>
      {open ? (
        <div
          id="admin-mobile-nav"
          className="absolute inset-x-0 top-14 z-40 border-b bg-background p-4 shadow-sm"
        >
          <AdminNav onNavigate={() => setOpen(false)} />
          <form action={signOut} className="mt-4 border-t pt-4">
            <Button type="submit" variant="ghost" className="w-full justify-start">
              Sign out
            </Button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
