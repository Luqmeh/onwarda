"use server";

import { redirect } from "next/navigation";

import { guestPortalPath } from "@/config/app";
import { createServiceRoleClient } from "@/lib/database/admin";
import { recordGuestExperienceEvent } from "@/lib/guest-portal/events";
import { loadGuestStay } from "@/lib/guest-portal/load";
import { inspectGuestPortalToken } from "@/lib/guest-portal/resolve";
import {
  guestArrivalNotesSchema,
  guestIssueSchema,
  guestOnboardingSchema,
} from "@/lib/validation/guest-portal";

export type GuestMutationState = {
  error?: string;
  success?: string;
};

function guestMutationError(status: string | null | undefined): GuestMutationState {
  if (status === "expired") {
    return { error: "This guest link has expired." };
  }

  if (status === "revoked" || status === "unavailable") {
    return { error: "This stay is no longer available." };
  }

  if (status === "invalid_input") {
    return { error: "Please check the information you entered." };
  }

  return { error: "This guest link is invalid." };
}

async function requireValidGuestHash(token: string) {
  const inspected = await inspectGuestPortalToken(token);

  if (inspected.status !== "valid") {
    return { ok: false as const, state: guestMutationError(inspected.status) };
  }

  return { ok: true as const, tokenHash: inspected.tokenHash };
}

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

async function redirectToGuestContinue(token: string, fallback = "/"): Promise<never> {
  const stay = await loadGuestStay(token);

  if (stay.status !== "ok") {
    redirect(guestPortalPath(token, fallback));
  }

  const href = stay.journey.allRequiredComplete ? "/" : stay.journey.nextStep.href;
  redirect(guestPortalPath(token, href === "/" ? "" : href));
}

export async function updateGuestOnboardingAction(
  token: string,
  previous: GuestMutationState,
  formData: FormData,
): Promise<GuestMutationState> {
  void previous;
  const inspected = await requireValidGuestHash(token);

  if (!inspected.ok) {
    return inspected.state;
  }

  const parsed = guestOnboardingSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    numberOfGuests: formData.get("numberOfGuests"),
    arrivalNotes: formData.get("arrivalNotes"),
  });

  if (!parsed.success) {
    return { error: "Enter your name, party size, and any arrival notes you want to share." };
  }

  const privileged = createServiceRoleClient();
  const { data, error } = await privileged.rpc("guest_update_onboarding", {
    p_token_hash: inspected.tokenHash,
    p_first_name: parsed.data.firstName,
    p_last_name: parsed.data.lastName,
    p_email: parsed.data.email ?? null,
    p_phone: parsed.data.phone ?? null,
    p_number_of_guests: parsed.data.numberOfGuests,
    p_arrival_notes: parsed.data.arrivalNotes ?? null,
  });

  const payload = asRecord(data);

  if (error || payload?.status !== "ok") {
    return guestMutationError(typeof payload?.status === "string" ? payload.status : null);
  }

  await recordGuestExperienceEvent(inspected.tokenHash, "guest_onboarding_completed");
  return redirectToGuestContinue(token, "/onboarding");
}

export async function updateGuestArrivalAction(
  token: string,
  previous: GuestMutationState,
  formData: FormData,
): Promise<GuestMutationState> {
  void previous;
  const inspected = await requireValidGuestHash(token);

  if (!inspected.ok) {
    return inspected.state;
  }

  const parsed = guestArrivalNotesSchema.safeParse({
    arrivalNotes: formData.get("arrivalNotes"),
  });

  if (!parsed.success) {
    return { error: "Share a short note about how you plan to arrive." };
  }

  const privileged = createServiceRoleClient();
  const { data, error } = await privileged.rpc("guest_update_arrival_notes", {
    p_token_hash: inspected.tokenHash,
    p_arrival_notes: parsed.data.arrivalNotes,
  });

  const payload = asRecord(data);

  if (error || payload?.status !== "ok") {
    return guestMutationError(typeof payload?.status === "string" ? payload.status : null);
  }

  return redirectToGuestContinue(token, "/arrival");
}

export async function acceptGuestRulesAction(
  token: string,
  previous: GuestMutationState,
  formData: FormData,
): Promise<GuestMutationState> {
  void previous;
  void formData;
  const inspected = await requireValidGuestHash(token);

  if (!inspected.ok) {
    return inspected.state;
  }

  const privileged = createServiceRoleClient();
  const { data, error } = await privileged.rpc("guest_accept_rules", {
    p_token_hash: inspected.tokenHash,
  });

  const payload = asRecord(data);

  if (payload?.status === "not_applicable") {
    return redirectToGuestContinue(token, "/rules");
  }

  if (error || payload?.status !== "ok") {
    return guestMutationError(typeof payload?.status === "string" ? payload.status : null);
  }

  await recordGuestExperienceEvent(inspected.tokenHash, "guest_rules_accepted");
  return redirectToGuestContinue(token, "/rules");
}

export async function createGuestIssueAction(
  token: string,
  previous: GuestMutationState,
  formData: FormData,
): Promise<GuestMutationState> {
  void previous;
  const inspected = await requireValidGuestHash(token);

  if (!inspected.ok) {
    return inspected.state;
  }

  const parsed = guestIssueSchema.safeParse({
    category: formData.get("category"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    return { error: "Choose a category and describe the issue." };
  }

  const privileged = createServiceRoleClient();
  const { data, error } = await privileged.rpc("guest_create_issue", {
    p_token_hash: inspected.tokenHash,
    p_category: parsed.data.category,
    p_description: parsed.data.description,
  });

  const payload = asRecord(data);

  if (error || payload?.status !== "ok") {
    return guestMutationError(typeof payload?.status === "string" ? payload.status : "invalid_input");
  }

  await recordGuestExperienceEvent(inspected.tokenHash, "guest_issue_created");
  return { success: "Your request was sent to the host." };
}

export async function completeGuestCheckoutAction(
  token: string,
  previous: GuestMutationState,
  formData: FormData,
): Promise<GuestMutationState> {
  void previous;
  void formData;
  const inspected = await requireValidGuestHash(token);

  if (!inspected.ok) {
    return inspected.state;
  }

  const privileged = createServiceRoleClient();
  const { data, error } = await privileged.rpc("guest_complete_checkout", {
    p_token_hash: inspected.tokenHash,
  });

  const payload = asRecord(data);

  if (error || payload?.status !== "ok") {
    return guestMutationError(typeof payload?.status === "string" ? payload.status : null);
  }

  await recordGuestExperienceEvent(inspected.tokenHash, "guest_checkout_completed");
  redirect(guestPortalPath(token, "/checkout"));
}
