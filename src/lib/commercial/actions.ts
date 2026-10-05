"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { CLIENT_ROUTES } from "@/config/client";
import { authRedirectUrl } from "@/lib/url";
import { getCommercialPlan, isSelectableCommercialPlan } from "@/config/pricing";
import { createServiceRoleClient } from "@/lib/database/admin";
import { createSupabaseServerClient } from "@/lib/database/server";
import { recordMarketingEvent } from "@/lib/marketing/events";
import {
  commercialInquirySchema,
  commercialOnboardingSchema,
  commercialSignupSchema,
} from "@/lib/validation/commercial";

export type CommercialActionState = {
  error?: string;
  success?: string;
};

const SELECTED_PLAN_COOKIE = "onwarda_selected_plan";

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export async function rememberSelectedPlan(planId: string) {
  if (!isSelectableCommercialPlan(planId)) {
    return;
  }

  const store = await cookies();
  store.set(SELECTED_PLAN_COOKIE, planId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function readSelectedPlanHint(queryPlan?: string | null) {
  if (isSelectableCommercialPlan(queryPlan)) {
    return queryPlan;
  }

  const store = await cookies();
  const cookiePlan = store.get(SELECTED_PLAN_COOKIE)?.value;
  return isSelectableCommercialPlan(cookiePlan) ? cookiePlan : null;
}

async function completeOnboarding(input: {
  organizationName: string;
  plan: string;
  phone?: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("complete_commercial_onboarding", {
    p_organization_name: input.organizationName,
    p_plan: input.plan,
    p_phone: input.phone ?? null,
  });

  const payload = asRecord(data);

  if (error || payload?.status !== "ok") {
    if (payload?.status === "forbidden") {
      return { error: "Platform administrators cannot create a customer organization." };
    }

    if (payload?.status === "invalid_plan") {
      return { error: "Choose a published Onwarda plan." };
    }

    if (payload?.status === "unauthenticated") {
      return { error: "Sign in to finish setting up your organization." };
    }

    return { error: "We could not finish setting up your organization." };
  }

  if (payload.subscriptionStatus === "pending" || payload.subscriptionStatus === undefined) {
    await recordMarketingEvent({ type: "signup_completed", path: "/signup", plan: input.plan });
  }

  return { ok: true as const, existing: payload.existing === true };
}

export async function commercialSignupAction(
  previous: CommercialActionState,
  formData: FormData,
): Promise<CommercialActionState> {
  void previous;
  const parsed = commercialSignupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
    organizationName: formData.get("organizationName"),
    phone: formData.get("phone"),
    plan: formData.get("plan"),
  });

  if (!parsed.success) {
    return { error: "Check your name, email, password, organization, and selected plan." };
  }

  if (!getCommercialPlan(parsed.data.plan)) {
    return { error: "Choose a published Onwarda plan." };
  }

  await rememberSelectedPlan(parsed.data.plan);
  await recordMarketingEvent({ type: "signup_started", path: "/signup", plan: parsed.data.plan });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: authRedirectUrl("/login"),
    },
  });

  if (error) {
    if (/already registered|already exists|User already registered/i.test(error.message)) {
      return { error: "An account with this email already exists. Log in to continue." };
    }

    return { error: "We could not create that account. Try a different email." };
  }

  if (!data.session) {
    return {
      error:
        "Check your email to confirm the account, then log in to finish organization setup. Your selected plan will be waiting.",
    };
  }

  const completed = await completeOnboarding({
    organizationName: parsed.data.organizationName,
    plan: parsed.data.plan,
    phone: parsed.data.phone,
  });

  if ("error" in completed && completed.error) {
    return { error: completed.error };
  }

  redirect(`${CLIENT_ROUTES.root}?notice=payment-setup`);
}

export async function commercialOnboardingAction(
  previous: CommercialActionState,
  formData: FormData,
): Promise<CommercialActionState> {
  void previous;
  const parsed = commercialOnboardingSchema.safeParse({
    organizationName: formData.get("organizationName"),
    phone: formData.get("phone"),
    plan: formData.get("plan"),
  });

  if (!parsed.success) {
    return { error: "Check your organization name and selected plan." };
  }

  await rememberSelectedPlan(parsed.data.plan);
  const completed = await completeOnboarding({
    organizationName: parsed.data.organizationName,
    plan: parsed.data.plan,
    phone: parsed.data.phone,
  });

  if ("error" in completed && completed.error) {
    return { error: completed.error };
  }

  redirect(`${CLIENT_ROUTES.root}?notice=payment-setup`);
}

export async function selectCommercialPlanAction(plan: string, nextPath: string) {
  if (!isSelectableCommercialPlan(plan)) {
    redirect("/pricing");
  }

  await rememberSelectedPlan(plan);
  await recordMarketingEvent({
    type: "pricing_plan_selected",
    path: "/pricing",
    plan,
  });

  const destination = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/signup";
  redirect(destination);
}

export async function submitCommercialInquiryAction(
  previous: CommercialActionState,
  formData: FormData,
): Promise<CommercialActionState> {
  void previous;
  const parsed = commercialInquirySchema.safeParse({
    kind: formData.get("kind") || "contact",
    name: formData.get("name"),
    email: formData.get("email"),
    companyName: formData.get("companyName"),
    propertyCount: formData.get("propertyCount"),
    message: formData.get("message"),
    plan: formData.get("plan"),
  });

  if (!parsed.success) {
    return { error: "Enter your name, email, and a short message." };
  }

  const privileged = createServiceRoleClient();
  const { data, error } = await privileged.rpc("submit_commercial_inquiry", {
    p_kind: parsed.data.kind,
    p_name: parsed.data.name,
    p_email: parsed.data.email,
    p_company_name: parsed.data.companyName ?? null,
    p_property_count: parsed.data.propertyCount ?? null,
    p_message: parsed.data.message,
    p_plan: parsed.data.plan ?? null,
  });

  const payload = asRecord(data);

  if (error || payload?.status !== "ok") {
    return { error: "We could not send that message. Try again." };
  }

  await recordMarketingEvent({
    type: parsed.data.kind === "demo" ? "demo_requested" : "contact_submitted",
    path: "/contact",
    plan: parsed.data.plan,
  });

  return { success: "Thank you. Onwarda will be in touch." };
}
