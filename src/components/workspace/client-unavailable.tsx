import Link from "next/link";

import { SignOutButton } from "@/components/shared/sign-out-button";
import { Button } from "@/components/ui/button";
import { CLIENT_LOGIN } from "@/config/client";
import { OnwardaWordmark } from "@/components/brand/onwarda-wordmark";

type ClientUnavailableProps = {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
};

export function ClientUnavailable({
  title,
  description,
  actionHref,
  actionLabel,
}: ClientUnavailableProps) {
  return (
    <main className="onwarda-client flex min-h-svh items-center justify-center px-6">
      <div className="w-full max-w-md rounded-[var(--onwarda-radius)] border bg-onwarda-white p-8 shadow-onwarda">
        <OnwardaWordmark className="mb-6 block" />
        <h1 className="text-2xl font-medium tracking-tight">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-onwarda-muted">{description}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          {actionHref && actionLabel ? (
            <Button asChild>
              <Link href={actionHref}>{actionLabel}</Link>
            </Button>
          ) : null}
          <SignOutButton redirectTo={CLIENT_LOGIN} />
        </div>
      </div>
    </main>
  );
}
