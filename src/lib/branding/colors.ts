import { ONWARDA_COLOR_TOKENS } from "@/config/brand";

const HEX_COLOR = /^#([0-9a-fA-F]{6})$/;
const UNSAFE_COLOR = /url\s*\(|javascript:|expression\s*\(|var\s*\(|--|[{};<>]|style=|@import/i;

export function isSafeBrandColor(value: string | null | undefined): value is string {
  if (!value || typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();

  if (UNSAFE_COLOR.test(trimmed)) {
    return false;
  }

  return HEX_COLOR.test(trimmed);
}

export function normalizeBrandColor(value: string | null | undefined): string | null {
  if (!isSafeBrandColor(value)) {
    return null;
  }

  return `#${value.trim().slice(1).toLowerCase()}`;
}

export function parseOptionalBrandColor(value: unknown): string | null {
  if (value == null) {
    return null;
  }

  const text = String(value).trim();

  if (!text) {
    return null;
  }

  const normalized = normalizeBrandColor(text);

  if (!normalized) {
    throw new Error("Color must be a 6-digit hex value such as #77764F.");
  }

  return normalized;
}

export const DEFAULT_BRAND_COLORS = {
  primary: ONWARDA_COLOR_TOKENS.olive,
  secondary: ONWARDA_COLOR_TOKENS.sage,
  accent: ONWARDA_COLOR_TOKENS.coral,
  background: ONWARDA_COLOR_TOKENS.cream,
} as const;
