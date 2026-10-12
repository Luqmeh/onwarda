import type { en } from "@/i18n/messages/en";

type Localized<T> = T extends string ? string : { [K in keyof T]: Localized<T[K]> };

export type MessageCatalog = Localized<typeof en>;
