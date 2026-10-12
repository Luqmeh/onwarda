import type { ReactNode } from "react";

import { getTextDirection } from "@/i18n/config";
import { getMessages } from "@/i18n/get-messages";
import { getRequestLocale } from "@/i18n/get-locale";
import { I18nProvider } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { SupportedLocale } from "@/types/enums";

export async function LocaleFrame({
  children,
  className,
  locale: forcedLocale,
}: {
  children: ReactNode;
  className?: string;
  locale?: SupportedLocale;
}) {
  const locale = forcedLocale ?? (await getRequestLocale());
  const messages = getMessages(locale);
  const direction = getTextDirection(locale);

  return (
    <div lang={locale} dir={direction} className={cn(direction === "rtl" && "font-arabic", className)}>
      <I18nProvider locale={locale} messages={messages}>
        {children}
      </I18nProvider>
    </div>
  );
}
