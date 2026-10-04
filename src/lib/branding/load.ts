import "server-only";

import { createWorkspaceBrandingLogoSignedUrl } from "@/lib/branding/signed-url";
import {
  resolveOrganizationBranding,
  type ResolvedOrganizationBranding,
} from "@/lib/branding/resolve";
import { createSupabaseServerClient } from "@/lib/database/server";
import type { OrganizationBrandingRecord } from "@/types/database";
import type { WorkspaceView } from "@/types/auth";

type BrandingColumns = Pick<
  OrganizationBrandingRecord,
  | "display_name"
    | "public_description"
    | "logo_path"
    | "primary_color"
    | "secondary_color"
    | "accent_color"
>;

export async function loadOrganizationBrandingRecord(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("organization_branding")
    .select("display_name, public_description, logo_path, primary_color, secondary_color, accent_color")
    .eq("organization_id", organizationId)
    .maybeSingle();

  return (data as BrandingColumns | null) ?? null;
}

export async function loadWorkspaceBranding(
  view: WorkspaceView,
): Promise<ResolvedOrganizationBranding> {
  const organization = view.context.organization;
  const branding = await loadOrganizationBrandingRecord(organization.id);
  const logoUrl = branding?.logo_path
    ? await createWorkspaceBrandingLogoSignedUrl(branding.logo_path)
    : null;

  return resolveOrganizationBranding({
    organizationId: organization.id,
    organizationName: organization.name,
    branding,
    logoUrl,
  });
}
