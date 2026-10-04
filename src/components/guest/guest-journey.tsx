import Link from "next/link";

import { guestPortalPath } from "@/config/app";
import type { GuestJourney, GuestJourneyNextStep, GuestJourneyStep } from "@/lib/guest-portal/journey";
import { cn } from "@/lib/utils";

export function GuestPageHeader({
  token,
  section,
  title,
  description,
  backHref = "",
}: {
  token: string;
  section: string;
  title: string;
  description?: string;
  backHref?: string;
}) {
  return (
    <header className="mb-6">
      <Link
        href={guestPortalPath(token, backHref)}
        className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--client-primary)] underline-offset-4 hover:underline"
      >
        <span aria-hidden="true">← </span>
        Back
      </Link>
      <p className="onwarda-kicker mt-3">{section}</p>
      <h1 className="onwarda-display mt-2">{title}</h1>
      {description ? <p className="mt-2 text-sm leading-relaxed text-onwarda-muted">{description}</p> : null}
    </header>
  );
}

export function GuestContinueLink({
  token,
  next,
  className,
}: {
  token: string;
  next: GuestJourneyNextStep;
  className?: string;
}) {
  return (
    <Link
      href={guestPortalPath(token, next.href === "/" ? "" : next.href)}
      className={cn(
        "inline-flex min-h-12 w-full items-center justify-center rounded-[var(--onwarda-radius)] bg-[var(--client-primary)] px-4 text-center text-sm font-medium text-onwarda-white",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--client-primary)] focus-visible:ring-offset-2",
        className,
      )}
    >
      {next.ctaLabel}
    </Link>
  );
}

export function GuestEmptyState({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[var(--onwarda-radius)] bg-onwarda-white p-5 shadow-onwarda">
      <h2 className="font-medium">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-onwarda-muted">{body}</p>
    </div>
  );
}

export function GuestJourneyChecklist({
  token,
  steps,
}: {
  token: string;
  steps: GuestJourneyStep[];
}) {
  return (
    <ol className="mt-5 space-y-2">
      {steps.map((step) => {
        const icon =
          step.state === "complete" ? "✓" : step.state === "current" ? "→" : step.state === "not_applicable" ? "—" : "○";
        const statusLabel =
          step.state === "complete"
            ? "Completed"
            : step.state === "current"
              ? "Current step"
              : step.state === "not_applicable"
                ? "Not required"
                : "Not started";

        return (
          <li key={step.key}>
            <Link
              href={guestPortalPath(token, step.href)}
              className={cn(
                "flex min-h-14 items-start gap-3 rounded-[var(--onwarda-radius)] px-4 py-3",
                step.state === "current"
                  ? "bg-[color-mix(in_srgb,var(--client-primary)_10%,var(--onwarda-white))] ring-1 ring-[var(--client-primary)]"
                  : "bg-onwarda-cream/80",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm",
                  step.state === "complete" && "bg-[var(--client-primary)] text-onwarda-white",
                  step.state === "current" && "text-[var(--client-primary)]",
                  step.state === "upcoming" && "text-onwarda-muted",
                  step.state === "not_applicable" && "text-onwarda-muted",
                )}
              >
                {icon}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className="font-medium">{step.title}</span>
                  <span className="sr-only">{statusLabel}</span>
                </span>
                <span className="mt-0.5 block text-sm text-onwarda-muted">{step.description}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

export function GuestInformationHub({
  token,
}: {
  token: string;
}) {
  const links = [
    ["Arrival & access", "/arrival"],
    ["Wi-Fi", "/wifi"],
    ["House rules", "/rules"],
    ["Property information", "/property"],
    ["Guides", "/guides"],
    ["Contact host", "/support"],
  ] as const;

  return (
    <section className="mt-8">
      <h2 className="onwarda-kicker">Your stay</h2>
      <ul className="mt-3 grid gap-3">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link
              href={guestPortalPath(token, href)}
              className="flex min-h-12 items-center justify-between rounded-[var(--onwarda-radius)] bg-onwarda-white px-4 shadow-onwarda"
            >
              <span>{label}</span>
              <span aria-hidden="true">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function GuestReadyActions({ token }: { token: string }) {
  return (
    <div className="mt-5 grid gap-3">
      <Link
        href={guestPortalPath(token, "/arrival")}
        className="inline-flex min-h-12 items-center justify-center rounded-[var(--onwarda-radius)] bg-[var(--client-primary)] px-4 text-sm font-medium text-onwarda-white"
      >
        View arrival & access
      </Link>
      <Link
        href={guestPortalPath(token, "/property")}
        className="inline-flex min-h-12 items-center justify-center rounded-[var(--onwarda-radius)] bg-onwarda-white px-4 text-sm font-medium shadow-onwarda"
      >
        Explore your stay
      </Link>
    </div>
  );
}

export function guestProgressLabel(journey: GuestJourney) {
  return `Guest journey: ${journey.completedCount} of ${journey.requiredCount} required steps complete.`;
}
