import "server-only";

import { createSupabaseServerClient } from "@/lib/database/server";
import { isOnboardingStep, type OnboardingStepId } from "@/lib/onboarding/steps";
import { requireCurrentOrganization } from "@/lib/tenancy/context";

export type OnboardingSnapshot = {
  organizationName: string;
  email: string;
  phone: string;
  country: string;
  defaultLanguage: string;
  needsPassword: boolean;
  step: OnboardingStepId;
  completed: boolean;
  branding: {
    displayName: string;
    publicDescription: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
  };
  properties: Array<{ id: string; name: string; city: string | null }>;
  guides: Array<{ id: string; title: string; propertyName: string }>;
  cleaners: string[];
  checklist: Array<{
    key: "business" | "branding" | "property" | "guide" | "cleaner";
    label: string;
    done: boolean;
    optional: boolean;
  }>;
};

export async function loadOnboardingSnapshot(needsPassword: boolean): Promise<OnboardingSnapshot> {
  const context = await requireCurrentOrganization();
  const supabase = await createSupabaseServerClient();
  const organizationId = context.organization.id;

  const [progress, branding, properties, guides, cleaners] = await Promise.all([
    supabase
      .from("organization_onboarding")
      .select("status, current_step")
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase
      .from("organization_branding")
      .select("display_name, public_description, primary_color, secondary_color, accent_color")
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase
      .from("properties")
      .select("id, name, city")
      .eq("organization_id", organizationId)
      .neq("status", "archived")
      .order("name"),
    supabase
      .from("property_knowledge")
      .select("id, title, properties(name)")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("cleaning_agents")
      .select("display_name")
      .eq("organization_id", organizationId)
      .eq("active", true)
      .order("display_name"),
  ]);

  const step = isOnboardingStep(progress.data?.current_step) ? progress.data.current_step : "welcome";
  const propertyRows = properties.data ?? [];
  const guideRows = guides.data ?? [];

  return {
    organizationName: context.organization.name,
    email: context.user.email ?? "",
    phone: context.organization.phone ?? "",
    country: context.organization.country ?? "",
    defaultLanguage: context.organization.default_language,
    needsPassword,
    step: needsPassword ? "welcome" : step,
    completed: progress.data?.status === "completed",
    branding: {
      displayName: branding.data?.display_name ?? context.organization.name,
      publicDescription: branding.data?.public_description ?? "",
      primaryColor: branding.data?.primary_color ?? "#77764f",
      secondaryColor: branding.data?.secondary_color ?? "#b2b184",
      accentColor: branding.data?.accent_color ?? "#dd817a",
    },
    properties: propertyRows,
    guides: guideRows.map((guide) => {
      const property = Array.isArray(guide.properties) ? guide.properties[0] : guide.properties;
      return {
        id: guide.id,
        title: guide.title,
        propertyName: property?.name ?? "Property",
      };
    }),
    cleaners: (cleaners.data ?? []).map((cleaner) => cleaner.display_name),
    checklist: [
      { key: "business", label: "Business profile", done: Boolean(context.organization.name), optional: false },
      { key: "branding", label: "Branding", done: Boolean(branding.data?.display_name), optional: true },
      { key: "property", label: "A property", done: propertyRows.length > 0, optional: false },
      { key: "guide", label: "A guest guide", done: guideRows.length > 0, optional: true },
      { key: "cleaner", label: "A cleaner", done: (cleaners.data ?? []).length > 0, optional: true },
    ],
  };
}

export async function readOnboardingGate() {
  const context = await requireCurrentOrganization();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("organization_onboarding")
    .select("status")
    .eq("organization_id", context.organization.id)
    .maybeSingle();

  return {
    role: context.membership.role,
    status: data?.status ?? null,
  };
}
