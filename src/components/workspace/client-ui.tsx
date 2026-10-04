import type { ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

type ClientPageHeaderProps = {
  kicker?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function ClientPageHeader({
  kicker,
  title,
  description,
  actions,
}: ClientPageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        {kicker ? <p className="onwarda-kicker">{kicker}</p> : null}
        <h1 className="onwarda-display">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-sm leading-relaxed text-onwarda-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

type ClientSectionCardProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function ClientSectionCard({
  title,
  description,
  action,
  children,
  className,
}: ClientSectionCardProps) {
  return (
    <section
      className={cn(
        "client-surface p-5 sm:p-6",
        className,
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-medium tracking-tight">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-onwarda-muted">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

type ClientEmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function ClientEmptyState({ title, description, action }: ClientEmptyStateProps) {
  return (
    <div className="rounded-[var(--onwarda-radius)] bg-[color-mix(in_srgb,var(--client-background)_80%,var(--client-secondary))] px-5 py-10 text-center">
      <p className="font-medium tracking-tight">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-onwarda-muted">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

type ClientMetricCardProps = {
  label: string;
  value: number;
  href?: string;
};

export function ClientMetricCard({ label, value, href }: ClientMetricCardProps) {
  const content = (
    <>
      <p className="text-sm text-onwarda-muted">{label}</p>
      <p className="mt-2 text-3xl font-medium tracking-tight text-onwarda-charcoal">{value}</p>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="client-surface client-lift px-5 py-4"
      >
        {content}
      </Link>
    );
  }

  return (
    <article className="client-surface px-5 py-4">
      {content}
    </article>
  );
}

type ClientStatusBadgeProps = {
  label: string;
  tone?: "neutral" | "olive" | "sage" | "coral";
};

export function ClientStatusBadge({ label, tone = "neutral" }: ClientStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-medium tracking-wide capitalize",
        tone === "olive" && "bg-onwarda-olive/10 text-onwarda-olive",
        tone === "sage" && "bg-onwarda-sage/25 text-onwarda-charcoal",
        tone === "coral" && "bg-onwarda-coral/15 text-onwarda-charcoal",
        tone === "neutral" && "bg-onwarda-cream text-onwarda-muted",
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </span>
  );
}
