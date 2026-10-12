"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { MessageCatalog } from "@/i18n/catalog";
import { getTextDirection } from "@/i18n/config";
import type { SupportedLocale } from "@/types/enums";

type I18nValue = {
  locale: SupportedLocale;
  direction: "ltr" | "rtl";
  messages: MessageCatalog;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: SupportedLocale;
  messages: MessageCatalog;
  children: ReactNode;
}) {
  return (
    <I18nContext.Provider value={{ locale, direction: getTextDirection(locale), messages }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error("Workspace translations are unavailable.");
  }

  return value;
}
