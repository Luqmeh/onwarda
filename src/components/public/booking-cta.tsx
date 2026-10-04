"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { recordPublicBookingCtaAction } from "@/lib/public/actions";

export function PublicBookingCta({
  organizationSlug,
  propertySlug,
  href,
  label = "Enquire or book",
}: {
  organizationSlug: string;
  propertySlug: string;
  href: string | null;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();
  const destination = href ?? `mailto:hello@${organizationSlug}.example`;

  return (
    <Button
      asChild
      size="lg"
      className="min-h-11 px-5"
      disabled={pending}
    >
      <a
        href={destination}
        target={href ? "_blank" : undefined}
        rel={href ? "noreferrer" : undefined}
        onClick={() => {
          startTransition(() => {
            void recordPublicBookingCtaAction(organizationSlug, propertySlug);
          });
        }}
      >
        {label}
      </a>
    </Button>
  );
}
