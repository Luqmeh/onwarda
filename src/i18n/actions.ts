"use server";

import { cookies } from "next/headers";

import { isSupportedLocale } from "@/i18n/config";
import { LOCALE_COOKIE, localeCookieOptions } from "@/i18n/locale";
import type { SupportedLocale } from "@/types/enums";

export async function setLocaleAction(locale: SupportedLocale) {
  if (!isSupportedLocale(locale)) {
    return;
  }

  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, localeCookieOptions());
}
