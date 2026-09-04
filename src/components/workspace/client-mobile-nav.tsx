"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";

import { ClientNav } from "@/components/workspace/client-nav";
import { Button } from "@/components/ui/button";
import { type ClientNavItem } from "@/config/client";

type ClientMobileNavProps = {
  items: ClientNavItem[];
};

export function ClientMobileNav({ items }: ClientMobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-expanded={open}
        aria-controls="client-mobile-nav"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X className="size-4" /> : <Menu className="size-4" />}
        <span className="sr-only">Toggle navigation</span>
      </Button>
      {open ? (
        <div
          id="client-mobile-nav"
          className="absolute inset-x-0 top-16 z-40 border-b bg-onwarda-white p-4 shadow-onwarda"
        >
          <ClientNav items={items} onNavigate={() => setOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}
