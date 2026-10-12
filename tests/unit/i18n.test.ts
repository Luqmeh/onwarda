import { describe, expect, it } from "vitest";

import { getTextDirection } from "@/i18n/config";
import { getMessages } from "@/i18n/get-messages";
import { formattingLocale, parseLocaleCookie } from "@/i18n/locale";
import { ar } from "@/i18n/messages/ar";
import { en } from "@/i18n/messages/en";
import { fr } from "@/i18n/messages/fr";

function leaves(value: unknown, path = ""): string[] {
  if (typeof value === "string") {
    return [path];
  }

  if (!value || typeof value !== "object") {
    throw new Error(`Unexpected message at ${path}`);
  }

  return Object.entries(value).flatMap(([key, child]) =>
    leaves(child, path ? `${path}.${key}` : key),
  );
}

describe("workspace languages", () => {
  it("keeps English, French, and Arabic dictionaries aligned and non-empty", () => {
    const catalogs = { en, fr, ar };
    const english = leaves(en).sort();

    for (const locale of ["fr", "ar"] as const) {
      const keys = leaves(catalogs[locale]).sort();
      expect(keys).toEqual(english);
      for (const key of keys) {
        const value = key.split(".").reduce<unknown>((current, part) => {
          return (current as Record<string, unknown>)[part];
        }, catalogs[locale]);
        expect(typeof value).toBe("string");
        expect(String(value).trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("uses native language names and does not use flags", () => {
    expect(en.languages).toEqual({
      label: "Language",
      en: "English",
      fr: "Français",
      ar: "العربية",
    });
    expect(JSON.stringify(getMessages("ar"))).not.toMatch(/[\u{1F1E6}-\u{1F1FF}]/u);
  });

  it("accepts only en, fr, and ar, and defaults to English", () => {
    expect(parseLocaleCookie("fr")).toBe("fr");
    expect(parseLocaleCookie("ar")).toBe("ar");
    expect(parseLocaleCookie("en")).toBe("en");
    expect(parseLocaleCookie("es")).toBe("en");
    expect(parseLocaleCookie(null)).toBe("en");
    expect(getTextDirection("ar")).toBe("rtl");
    expect(getTextDirection("en")).toBe("ltr");
    expect(getTextDirection("fr")).toBe("ltr");
    expect(formattingLocale("ar")).toBe("ar-MA");
    expect(formattingLocale("fr")).toBe("fr-MA");
  });
});
