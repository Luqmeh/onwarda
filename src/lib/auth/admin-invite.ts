import { ADMIN_ROUTES } from "@/config/admin";
import { onboardingPasswordSchema } from "@/lib/validation/onboarding";
import { PLATFORM_ADMIN_ROLES, PLATFORM_ADMIN_STATUSES } from "@/types/enums";

export const ADMIN_INVITE_PATH = ADMIN_ROUTES.accept;
export const ADMIN_INVITE_MFA_PATH = ADMIN_ROUTES.mfaSetup;

export const ADMIN_INVITE_INVALID =
  "This invitation link is invalid or has expired.";
export const ADMIN_RECOVERY_INVALID =
  "This recovery link is invalid or has expired.";
export const ADMIN_INVITE_UNSUPPORTED =
  "This link cannot be used to set up a platform administrator.";
export const ADMIN_INVITE_NOT_ADMIN =
  "This invitation is not for an active platform administrator.";
export const ADMIN_RECOVERY_NOT_ADMIN =
  "This recovery link is not for an active platform administrator.";
export const ADMIN_INVITE_PASSWORD_FAILED =
  "The password could not be saved. Try a different one.";

const UNSUPPORTED_TYPES = new Set([
  "signup",
  "magiclink",
  "email_change",
  "email",
  "sms",
  "phone_change",
]);

export type AdminAcceptPurpose = "invite" | "recovery";

export type AdminInviteCredentials =
  | {
      kind: "hash";
      purpose: AdminAcceptPurpose;
      accessToken: string;
      refreshToken: string;
    }
  | { kind: "code"; purpose: AdminAcceptPurpose; code: string }
  | { kind: "token_hash"; purpose: AdminAcceptPurpose; tokenHash: string };

export type AdminInviteParse =
  | { status: "ready"; credentials: AdminInviteCredentials }
  | { status: "absent" }
  | {
      status: "rejected";
      reason: "unsupported" | "invalid";
      purpose?: AdminAcceptPurpose;
    };

type InviteAuth = {
  setSession: (session: {
    access_token: string;
    refresh_token: string;
  }) => Promise<{ error: { message: string } | null }>;
  exchangeCodeForSession: (
    code: string,
  ) => Promise<{ error: { message: string } | null }>;
  verifyOtp: (params: {
    token_hash: string;
    type: "invite" | "recovery";
  }) => Promise<{ error: { message: string } | null }>;
};

export type AdminInviteEstablish =
  | { status: "ready"; clearLocation: true; purpose: AdminAcceptPurpose }
  | { status: "absent"; clearLocation: false }
  | {
      status: "rejected";
      reason: "unsupported" | "invalid";
      message: string;
      clearLocation: boolean;
      purpose: AdminAcceptPurpose;
    };

function searchParams(value: string) {
  const trimmed = value.startsWith("#") || value.startsWith("?") ? value.slice(1) : value;
  return new URLSearchParams(trimmed);
}

function typeOf(
  params: URLSearchParams,
): AdminAcceptPurpose | "unsupported" | "missing" {
  const type = params.get("type");
  if (!type) return "missing";
  if (type === "invite" || type === "recovery") return type;
  if (UNSUPPORTED_TYPES.has(type)) return "unsupported";
  return "unsupported";
}

export function parseAdminInviteLocation(input: {
  hash: string;
  search: string;
}): AdminInviteParse {
  const hash = searchParams(input.hash);
  const search = searchParams(input.search);
  const hashType = typeOf(hash);
  const searchType = typeOf(search);

  if (hashType === "unsupported" || searchType === "unsupported") {
    return { status: "rejected", reason: "unsupported" };
  }

  if (hashType !== "missing" && searchType !== "missing" && hashType !== searchType) {
    return { status: "rejected", reason: "invalid" };
  }

  if (hashType === "invite" || hashType === "recovery") {
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    if (!accessToken || !refreshToken) {
      return { status: "rejected", reason: "invalid", purpose: hashType };
    }

    return {
      status: "ready",
      credentials: {
        kind: "hash",
        purpose: hashType,
        accessToken,
        refreshToken,
      },
    };
  }

  if (hash.get("access_token") || hash.get("refresh_token")) {
    return { status: "rejected", reason: "invalid" };
  }

  const tokenHash = search.get("token_hash");
  if (tokenHash) {
    if (searchType !== "invite" && searchType !== "recovery") {
      return { status: "rejected", reason: "invalid" };
    }

    return {
      status: "ready",
      credentials: { kind: "token_hash", purpose: searchType, tokenHash },
    };
  }

  const code = search.get("code");
  if (code) {
    const purpose: AdminAcceptPurpose = searchType === "recovery" ? "recovery" : "invite";
    return { status: "ready", credentials: { kind: "code", purpose, code } };
  }

  if (
    hash.get("error") ||
    hash.get("error_description") ||
    search.get("error") ||
    search.get("error_description")
  ) {
    return { status: "rejected", reason: "invalid" };
  }

  return { status: "absent" };
}

export function adminInviteRejectionMessage(
  reason: "unsupported" | "invalid",
  purpose: AdminAcceptPurpose = "invite",
) {
  if (reason === "unsupported") return ADMIN_INVITE_UNSUPPORTED;
  return purpose === "recovery" ? ADMIN_RECOVERY_INVALID : ADMIN_INVITE_INVALID;
}

export function adminAcceptNotAdminMessage(purpose: AdminAcceptPurpose) {
  return purpose === "recovery" ? ADMIN_RECOVERY_NOT_ADMIN : ADMIN_INVITE_NOT_ADMIN;
}

export async function establishAdminInviteSession(
  auth: InviteAuth,
  location: { hash: string; search: string },
): Promise<AdminInviteEstablish> {
  const parsed = parseAdminInviteLocation(location);

  if (parsed.status === "absent") {
    return { status: "absent", clearLocation: false };
  }

  if (parsed.status === "rejected") {
    const purpose = parsed.purpose ?? "invite";
    return {
      status: "rejected",
      reason: parsed.reason,
      message: adminInviteRejectionMessage(parsed.reason, purpose),
      clearLocation: false,
      purpose,
    };
  }

  const { credentials } = parsed;
  const invalidMessage = adminInviteRejectionMessage("invalid", credentials.purpose);

  try {
    const result =
      credentials.kind === "hash"
        ? await auth.setSession({
            access_token: credentials.accessToken,
            refresh_token: credentials.refreshToken,
          })
        : credentials.kind === "code"
          ? await auth.exchangeCodeForSession(credentials.code)
          : await auth.verifyOtp({
              token_hash: credentials.tokenHash,
              type: credentials.purpose,
            });

    if (result.error) {
      return {
        status: "rejected",
        reason: "invalid",
        message: invalidMessage,
        clearLocation: true,
        purpose: credentials.purpose,
      };
    }
  } catch {
    return {
      status: "rejected",
      reason: "invalid",
      message: invalidMessage,
      clearLocation: true,
      purpose: credentials.purpose,
    };
  }

  return { status: "ready", clearLocation: true, purpose: credentials.purpose };
}

export function adminInviteEligibility(
  row: { role: string; status: string } | null,
): "accept" | "deny" {
  if (!row) return "deny";
  if (row.role !== PLATFORM_ADMIN_ROLES.SUPER_ADMIN) return "deny";
  if (row.status !== PLATFORM_ADMIN_STATUSES.ACTIVE) return "deny";
  return "accept";
}

export function adminInvitePasswordInput(password: unknown, confirmPassword: unknown) {
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

export function adminInvitePasswordResult(error: { message: string } | null):
  | { ok: true; next: typeof ADMIN_INVITE_MFA_PATH }
  | { ok: false; message: string } {
  if (error) {
    return { ok: false, message: ADMIN_INVITE_PASSWORD_FAILED };
  }

  return { ok: true, next: ADMIN_INVITE_MFA_PATH };
}
