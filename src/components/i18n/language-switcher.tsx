"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { setLocaleAction } from "@/i18n/actions";
import { useI18n } from "@/i18n/provider";
import type { SupportedLocale } from "@/types/enums";

const OPTIONS = ["en", "fr", "ar"] as const;

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, messages } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onChange(next: SupportedLocale) {
    if (next === locale) return;
    startTransition(async () => {
      await setLocaleAction(next);
      router.refresh();
    });
  }

  return (
    <label className={className ?? "inline-flex items-center gap-2 text-sm"}>
      <span className="sr-only">{messages.languages.label}</span>
      <select
        aria-label={messages.languages.label}
        value={locale}
        disabled={pending}
        onChange={(event) => onChange(event.target.value as SupportedLocale)}
        className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm"
      >
        {OPTIONS.map((option) => (
          <option key={option} value={option}>
            {messages.languages[option]}
          </option>
        ))}
      </select>
    </label>
  );
}
