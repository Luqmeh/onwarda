import type { Metadata } from "next";
import { Geist, Noto_Sans_Arabic, Plus_Jakarta_Sans } from "next/font/google";

import { APP_NAME } from "@/config/app";
import { cn } from "@/lib/utils";

import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

const onwarda = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-onwarda",
  display: "swap",
});

const notoArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--font-arabic",
});

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} · The operating layer for hospitality`,
    template: `%s · ${APP_NAME}`,
  },
  description:
    "Onwarda is the operating layer for hospitality. Attract guests, guide every stay, and operate from one digital layer.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      dir="ltr"
      suppressHydrationWarning
      className={cn("font-sans", geist.variable, onwarda.variable, notoArabic.variable)}
    >
      <body className="min-h-svh antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
