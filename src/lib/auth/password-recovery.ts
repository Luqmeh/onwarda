import { ADMIN_ROUTES } from "@/config/admin";
import { CLIENT_LOGIN } from "@/config/client";
import { onboardingPasswordSchema } from "@/lib/validation/onboarding";
import { emailSchema } from "@/lib/validation/common";

export const CLIENT_FORGOT_PASSWORD_PATH = "/forgot-password";
export const ADMIN_FORGOT_PASSWORD_PATH = ADMIN_ROUTES.forgotPassword;

export const RECOVERY_REQUEST_MESSAGE =
  "If an account exists for that email address, a password recovery code will be sent shortly.";
export const RECOVERY_RATE_LIMIT_MESSAGE =
  "Wait a moment before requesting another code.";
export const RECOVERY_SEND_FAILED_MESSAGE =
  "The recovery email could not be sent. Try again.";
export const RECOVERY_CODE_INVALID_MESSAGE =
  "That code is invalid or has expired.";
export const RECOVERY_PASSWORD_FAILED_MESSAGE =
  "The password could not be saved. Try a different one.";
export const RECOVERY_RESEND_COOLDOWN_MS = 60_000;

const CODE_PATTERN = /^\d{6,10}$/;

export type PasswordAudience = "client" | "admin";

type AuthErrorLike = {
  message?: string;
  code?: string;
  status?: number;
} | null;

type RecoveryAuth = {
  verifyOtp: (params: {
    email: string;
    token: string;
    type: "recovery";
  }) => Promise<{ error: AuthErrorLike }>;
  resetPasswordForEmail: (
    email: string,
  ) => Promise<{ error: AuthErrorLike }>;
};

export function recoveryLoginPath(audience: PasswordAudience) {
  return audience === "admin" ? ADMIN_ROUTES.login : CLIENT_LOGIN;
}

export function recoveryEmailInput(value: unknown) {
  const parsed = emailSchema.safeParse(typeof value === "string" ? value.trim() : value);
  if (!parsed.success) {
    return { ok: false as const, message: "Enter a valid email address." };
  }

  return { ok: true as const, email: parsed.data };
}

function isRateLimited(error: AuthErrorLike) {
  if (!error) return false;
  const code = (error.code ?? "").toLowerCase();
  const message = (error.message ?? "").toLowerCase();
  return (
    error.status === 429 ||
    code.includes("rate") ||
    message.includes("rate limit") ||
    message.includes("too many")
  );
}

export function recoveryRequestOutcome(error: AuthErrorLike):
  | { status: "sent"; message: typeof RECOVERY_REQUEST_MESSAGE }
  | { status: "wait"; message: typeof RECOVERY_RATE_LIMIT_MESSAGE }
  | { status: "failed"; message: typeof RECOVERY_SEND_FAILED_MESSAGE } {
  if (!error) {
    return { status: "sent", message: RECOVERY_REQUEST_MESSAGE };
  }

  if (isRateLimited(error)) {
    return { status: "wait", message: RECOVERY_RATE_LIMIT_MESSAGE };
  }

  const message = (error.message ?? "").toLowerCase();
  const code = (error.code ?? "").toLowerCase();
  if (
    code.includes("user_not_found") ||
    message.includes("user not found") ||
    message.includes("not found")
  ) {
    return { status: "sent", message: RECOVERY_REQUEST_MESSAGE };
  }

  return { status: "failed", message: RECOVERY_SEND_FAILED_MESSAGE };
}

export function recoveryCodeInput(value: unknown) {
  const token = typeof value === "string" ? value.trim() : "";
  if (!CODE_PATTERN.test(token)) {
    return { ok: false as const, message: "Enter the code from the email." };
  }

  return { ok: true as const, token };
}

export async function requestPasswordRecovery(auth: RecoveryAuth, email: string) {
  try {
    const { error } = await auth.resetPasswordForEmail(email);
    return recoveryRequestOutcome(error);
  } catch {
    return recoveryRequestOutcome({ message: "network" });
  }
}

export async function verifyPasswordRecoveryCode(
  auth: RecoveryAuth,
  email: string,
  token: string,
) {
  const parsed = recoveryCodeInput(token);
  if (!parsed.ok) {
    return parsed;
  }

  try {
    const { error } = await auth.verifyOtp({
      email,
      token: parsed.token,
      type: "recovery",
    });
    if (error) {
      return { ok: false as const, message: RECOVERY_CODE_INVALID_MESSAGE };
    }
  } catch {
    return { ok: false as const, message: RECOVERY_CODE_INVALID_MESSAGE };
  }

  return { ok: true as const };
}

export function recoveryPasswordInput(password: unknown, confirmPassword: unknown) {
  const parsed = onboardingPasswordSchema.safeParse({ password, confirmPassword });
  if (parsed.success) {
    return { ok: true as const, password: parsed.data.password };
  }

  const mismatch = password !== confirmPassword;
  return {
    ok: false as const,
    message: mismatch
      ? "Passwords do not match."
      : "Use at least 8 characters, and enter the same password twice.",
  };
}

export function recoveryPasswordOutcome(error: AuthErrorLike, password: string) {
  if (!error) {
    return { ok: true as const };
  }

  if (error.message?.includes(password)) {
    return { ok: false as const, message: RECOVERY_PASSWORD_FAILED_MESSAGE };
  }

  return { ok: false as const, message: RECOVERY_PASSWORD_FAILED_MESSAGE };
}

export function reauthenticateOutcome(error: AuthErrorLike) {
  if (!error) {
    return {
      status: "sent" as const,
      message: "A verification code will be sent to your email.",
    };
  }

  if (isRateLimited(error)) {
    return { status: "wait" as const, message: RECOVERY_RATE_LIMIT_MESSAGE };
  }

  return {
    status: "failed" as const,
    message: "The verification email could not be sent. Try again.",
  };
}

export function passwordChangeOutcome(error: AuthErrorLike, secrets: {
  password: string;
  nonce: string;
}) {
  if (!error) {
    return { ok: true as const, message: "Your password has been changed." };
  }

  const message = error.message ?? "";
  if (message.includes(secrets.password) || message.includes(secrets.nonce)) {
    return {
      ok: false as const,
      message: "The password could not be changed. Check the code and try again.",
    };
  }

  return {
    ok: false as const,
    message: "The password could not be changed. Check the code and try again.",
  };
}
