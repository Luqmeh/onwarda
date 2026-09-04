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
        "rounded-[var(--onwarda-radius)] border bg-onwarda-white p-5 shadow-onwarda sm:p-6",
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
    <div className="rounded-[calc(var(--onwarda-radius)-0.15rem)] bg-onwarda-cream/80 px-5 py-8 text-center">
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
        className="rounded-[var(--onwarda-radius)] border bg-onwarda-white px-5 py-4 shadow-onwarda transition-colors hover:border-onwarda-olive/40"
      >
        {content}
      </Link>
    );
  }

  return (
    <article className="rounded-[var(--onwarda-radius)] border bg-onwarda-white px-5 py-4 shadow-onwarda">
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
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize",
        tone === "olive" && "bg-onwarda-olive/10 text-onwarda-olive",
        tone === "sage" && "bg-onwarda-sage/25 text-onwarda-charcoal",
        tone === "coral" && "bg-onwarda-coral/15 text-onwarda-charcoal",
        tone === "neutral" && "bg-onwarda-cream text-onwarda-muted",
      )}
    >
      {label}
    </span>
  );
}
