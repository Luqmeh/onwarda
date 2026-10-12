"use server";

import { redirect } from "next/navigation";

import { ADMIN_ROUTES, safeAdminPath } from "@/config/admin";
import { requirePlatformAdmin } from "@/lib/authorization/platform-admin";
import { createSupabaseServerClient } from "@/lib/database/server";
import { AuthenticationError, AuthorizationError } from "@/lib/errors";

export type MfaActionState = {
  error?: string;
};

const CODE = /^\d{6}$/;

function rethrowFrameworkError(error: unknown) {
  if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
    throw error;
  }

  if (typeof error === "object" && error && "digest" in error) {
    throw error;
  }
}

async function adminSession() {
  await requirePlatformAdmin();
  return createSupabaseServerClient();
}

export async function startAdminTotpEnrollment(): Promise<
  | { factorId: string; qrCode: string; secret: string }
  | { error: string }
> {
  try {
    const supabase = await adminSession();
    const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();

    if (listError) {
      return { error: "The authenticator setup could not be started." };
    }

    if ((factors?.totp ?? []).some((factor) => factor.status === "verified")) {
      return { error: "An authenticator is already enrolled. Enter a code to continue." };
    }

    for (const factor of factors?.totp ?? []) {
      if (factor.status !== "verified") {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Onwarda admin",
      issuer: "Onwarda",
    });

    if (error || !data?.id || !data.totp?.qr_code?.startsWith("data:image/") || !data.totp.secret) {
      return { error: "The authenticator setup could not be started." };
    }

    return {
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    };
  } catch (error) {
    rethrowFrameworkError(error);
    return { error: "The authenticator setup could not be started." };
  }
}

async function verifyFactor(factorId: string, code: string, nextPath: string) {
  if (!CODE.test(code)) {
    return { error: "Enter the 6-digit code from your authenticator app." };
  }

  const supabase = await adminSession();
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId,
  });

  if (challengeError || !challenge?.id) {
    return { error: "The verification code could not be checked. Try again." };
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });

  if (verifyError) {
    return { error: "That code is not valid. Privileged admin access stays locked." };
  }

  const { data: assurance, error: assuranceError } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (assuranceError || assurance?.currentLevel !== "aal2") {
    return { error: "The code was not accepted. Privileged admin access stays locked." };
  }

  redirect(safeAdminPath(nextPath));
}

export async function verifyAdminTotpEnrollment(
  _previous: MfaActionState,
  formData: FormData,
): Promise<MfaActionState> {
  try {
    return await verifyFactor(
      String(formData.get("factorId") ?? ""),
      String(formData.get("code") ?? ""),
      String(formData.get("next") ?? ""),
    );
  } catch (error) {
    rethrowFrameworkError(error);
    return { error: "The verification code could not be checked. Try again." };
  }
}

export async function verifyAdminTotpChallenge(
  _previous: MfaActionState,
  formData: FormData,
): Promise<MfaActionState> {
  try {
    const supabase = await adminSession();
    const { data: factors, error } = await supabase.auth.mfa.listFactors();
    const factor = (factors?.totp ?? []).find((item) => item.status === "verified");

    if (error || !factor) {
      redirect(ADMIN_ROUTES.mfaSetup);
    }

    return await verifyFactor(
      factor.id,
      String(formData.get("code") ?? ""),
      String(formData.get("next") ?? ""),
    );
  } catch (error) {
    rethrowFrameworkError(error);
    return { error: "The verification code could not be checked. Try again." };
  }
}
