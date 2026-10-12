import { DEFAULT_LOCALE } from "@/config/app";
import { isSupportedLocale } from "@/i18n/config";
import type { SupportedLocale } from "@/types/enums";

export const LOCALE_COOKIE = "onwarda_locale";
export const LOCALE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function parseLocaleCookie(value: string | undefined | null): SupportedLocale {
  if (value && isSupportedLocale(value)) {
    return value;
  }

  return DEFAULT_LOCALE;
}

export function fillMessage(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

export function formattingLocale(locale: SupportedLocale) {
  if (locale === "fr") return "fr-MA";
  if (locale === "ar") return "ar-MA";
  return "en";
}

export function localeCookieOptions() {
  return {
    path: "/",
    maxAge: LOCALE_MAX_AGE_SECONDS,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  };
}
