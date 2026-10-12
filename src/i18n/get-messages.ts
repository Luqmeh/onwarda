import type { MessageCatalog } from "@/i18n/catalog";
import { ar } from "@/i18n/messages/ar";
import { en } from "@/i18n/messages/en";
import { fr } from "@/i18n/messages/fr";
import type { SupportedLocale } from "@/types/enums";

const catalogs: Record<SupportedLocale, MessageCatalog> = { en, fr, ar };

export function getMessages(locale: SupportedLocale) {
  return catalogs[locale];
}
