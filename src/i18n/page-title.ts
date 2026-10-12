import type { Metadata } from "next";

import type { MessageCatalog } from "@/i18n/catalog";
import { getRequestI18n } from "@/i18n/get-locale";

export async function clientMetadata(
  pick: (messages: MessageCatalog) => { title: string; description?: string },
): Promise<Metadata> {
  const { messages } = await getRequestI18n();
  return pick(messages);
}
