import type { CSSProperties } from "react";

import { ONWARDA_COLOR_TOKENS } from "@/config/brand";
import { DEFAULT_BRAND_COLORS, normalizeBrandColor } from "@/lib/branding/colors";
import type { OrganizationBrandingRecord } from "@/types/database";

export type ResolvedOrganizationBranding = {
  organizationId: string;
  displayName: string;
  logoPath: string | null;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  storedDisplayName: string | null;
  storedPrimaryColor: string | null;
  storedSecondaryColor: string | null;
  storedAccentColor: string | null;
};

export function resolveOrganizationBranding(input: {
  organizationId: string;
  organizationName: string;
  branding?: Pick<
    OrganizationBrandingRecord,
    "display_name" | "logo_path" | "primary_color" | "secondary_color" | "accent_color"
  > | null;
  logoUrl?: string | null;
}): ResolvedOrganizationBranding {
  const displayName =
    input.branding?.display_name?.trim() || input.organizationName.trim() || "Workspace";

  const storedDisplayName = input.branding?.display_name?.trim() || null;
  const storedPrimaryColor = normalizeBrandColor(input.branding?.primary_color);
  const storedSecondaryColor = normalizeBrandColor(input.branding?.secondary_color);
  const storedAccentColor = normalizeBrandColor(input.branding?.accent_color);

  return {
    organizationId: input.organizationId,
    displayName,
    logoPath: input.branding?.logo_path ?? null,
    logoUrl: input.logoUrl ?? null,
    primaryColor: storedPrimaryColor ?? DEFAULT_BRAND_COLORS.primary,
    secondaryColor: storedSecondaryColor ?? DEFAULT_BRAND_COLORS.secondary,
    accentColor: storedAccentColor ?? DEFAULT_BRAND_COLORS.accent,
    backgroundColor: DEFAULT_BRAND_COLORS.background,
    storedDisplayName,
    storedPrimaryColor,
    storedSecondaryColor,
    storedAccentColor,
  };
}

export function organizationBrandStyle(
  branding: Pick<
    ResolvedOrganizationBranding,
    "primaryColor" | "secondaryColor" | "accentColor" | "backgroundColor"
  >,
) {
  return {
    "--client-primary": branding.primaryColor,
    "--client-secondary": branding.secondaryColor,
    "--client-accent": branding.accentColor,
    "--client-background": branding.backgroundColor,
    "--onwarda-org-accent": branding.accentColor,
  } as CSSProperties;
}

export function fallbackOrganizationBranding(
  organizationId: string,
  organizationName: string,
): ResolvedOrganizationBranding {
  return resolveOrganizationBranding({
    organizationId,
    organizationName,
    branding: null,
  });
}

export const ONWARDA_FALLBACK_BRAND = {
  displayName: "Onwarda",
  primaryColor: ONWARDA_COLOR_TOKENS.olive,
  secondaryColor: ONWARDA_COLOR_TOKENS.sage,
  accentColor: ONWARDA_COLOR_TOKENS.coral,
} as const;
