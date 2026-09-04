import { DEFAULT_LOCALE, RTL_LOCALES } from "@/config/app";
import { SUPPORTED_LOCALES, type SupportedLocale } from "@/types/enums";

export const locales = Object.values(SUPPORTED_LOCALES);

export function isSupportedLocale(value: string): value is SupportedLocale {
  return locales.includes(value as SupportedLocale);
}

export function getTextDirection(locale: SupportedLocale = DEFAULT_LOCALE) {
  return RTL_LOCALES.includes(locale as (typeof RTL_LOCALES)[number])
    ? "rtl"
    : "ltr";
}

export function getLocaleFromAcceptLanguage(
  header: string | null,
): SupportedLocale {
  if (!header) {
    return DEFAULT_LOCALE;
  }

  const requested = header
    .split(",")
    .map((part) => part.split(";")[0]?.trim().slice(0, 2));

  return requested.find(isSupportedLocale) ?? DEFAULT_LOCALE;
}
