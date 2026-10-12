import "server-only";

import { cookies } from "next/headers";

import { getMessages } from "@/i18n/get-messages";
import { parseLocaleCookie, LOCALE_COOKIE } from "@/i18n/locale";

export async function getRequestLocale() {
  const store = await cookies();
  return parseLocaleCookie(store.get(LOCALE_COOKIE)?.value);
}

export async function getRequestI18n() {
  const locale = await getRequestLocale();
  return { locale, messages: getMessages(locale) };
}
