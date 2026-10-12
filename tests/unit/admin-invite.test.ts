import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  ADMIN_INVITE_INVALID,
  ADMIN_INVITE_MFA_PATH,
  ADMIN_INVITE_PATH,
  ADMIN_INVITE_UNSUPPORTED,
  ADMIN_RECOVERY_INVALID,
  ADMIN_RECOVERY_NOT_ADMIN,
  adminAcceptNotAdminMessage,
  adminInviteEligibility,
  adminInvitePasswordInput,
  adminInvitePasswordResult,
  establishAdminInviteSession,
  parseAdminInviteLocation,
} from "@/lib/auth/admin-invite";

const ACCESS = "invite-access-token";
const REFRESH = "invite-refresh-token";
const CODE = "invite-auth-code";
const TOKEN_HASH = "invite-token-hash";

function authDouble() {
  return {
    setSession: vi.fn(async () => ({ error: null })),
    exchangeCodeForSession: vi.fn(async () => ({ error: null })),
    verifyOtp: vi.fn(async () => ({ error: null })),
  };
}

describe("platform administrator invitation acceptance", () => {
  it("accepts an invite hash only through setSession", async () => {
    const auth = authDouble();
    const result = await establishAdminInviteSession(auth, {
      hash: `#access_token=${ACCESS}&refresh_token=${REFRESH}&type=invite`,
      search: "",
    });

    expect(result).toEqual({ status: "ready", clearLocation: true, purpose: "invite" });
    expect(auth.setSession).toHaveBeenCalledWith({
      access_token: ACCESS,
      refresh_token: REFRESH,
    });
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(auth.verifyOtp).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain(ACCESS);
    expect(JSON.stringify(result)).not.toContain(REFRESH);
  });

  it("exchanges an authorization code without putting it into the result", async () => {
    const auth = authDouble();
    const result = await establishAdminInviteSession(auth, {
      hash: "",
      search: `?code=${CODE}`,
    });

    expect(result.status).toBe("ready");
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith(CODE);
    expect(auth.setSession).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain(CODE);
  });

  it("verifies an invite token hash with type invite", async () => {
    const auth = authDouble();
    const result = await establishAdminInviteSession(auth, {
      hash: "",
      search: `?token_hash=${TOKEN_HASH}&type=invite`,
    });

    expect(result.status).toBe("ready");
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: TOKEN_HASH,
      type: "invite",
    });
    expect(auth.setSession).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain(TOKEN_HASH);
  });

  it("rejects unsupported token types before calling Auth", async () => {
    const auth = authDouble();
    const cases = [
      { hash: `#access_token=${ACCESS}&refresh_token=${REFRESH}&type=magiclink`, search: "" },
      { hash: "", search: "?token_hash=recovery-hash&type=magiclink" },
      { hash: "", search: "?code=signup-code&type=signup" },
      { hash: "", search: "?token_hash=email-hash&type=email" },
      { hash: "", search: "?token_hash=change-hash&type=email_change" },
    ];

    for (const location of cases) {
      const result = await establishAdminInviteSession(auth, location);
      expect(result).toMatchObject({
        status: "rejected",
        reason: "unsupported",
        message: ADMIN_INVITE_UNSUPPORTED,
        clearLocation: false,
      });
    }

    expect(auth.setSession).not.toHaveBeenCalled();
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it("reports an expired or invalid invitation without echoing the provider error", async () => {
    const auth = authDouble();
    auth.verifyOtp.mockResolvedValue({
      error: { message: `otp expired for ${TOKEN_HASH}` },
    } as never);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await establishAdminInviteSession(auth, {
      hash: "",
      search: `?token_hash=${TOKEN_HASH}&type=invite`,
    });

    expect(result).toEqual({
      status: "rejected",
      reason: "invalid",
      message: ADMIN_INVITE_INVALID,
      clearLocation: true,
      purpose: "invite",
    });
    expect(JSON.stringify(result)).not.toContain(TOKEN_HASH);
    expect(log).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();

    log.mockRestore();
    info.mockRestore();
    error.mockRestore();
  });

  it("treats a provider error redirect as an invalid invitation", () => {
    expect(
      parseAdminInviteLocation({
        hash: "",
        search: "?error=access_denied&error_description=expired",
      }),
    ).toEqual({ status: "rejected", reason: "invalid" });
  });

  it("denies users without an active super administrator row", () => {
    expect(adminInviteEligibility(null)).toBe("deny");
    expect(adminInviteEligibility({ role: "super_admin", status: "suspended" })).toBe("deny");
    expect(adminInviteEligibility({ role: "owner", status: "active" })).toBe("deny");
    expect(adminInviteEligibility({ role: "super_admin", status: "active" })).toBe("accept");
  });

  it("rejects a mismatched password and a failed password update", () => {
    expect(adminInvitePasswordInput("password12", "password13")).toEqual({
      ok: false,
      message: "Passwords do not match.",
    });
    expect(adminInvitePasswordInput("short", "short")).toEqual({
      ok: false,
      message: "Use at least 8 characters, and enter the same password twice.",
    });

    const failed = adminInvitePasswordResult({ message: `could not save password12` });
    expect(failed).toEqual({
      ok: false,
      message: "The password could not be saved. Try a different one.",
    });
    expect(JSON.stringify(failed)).not.toContain("password12");
  });

  it("sends a successful password update only to MFA setup", () => {
    const result = adminInvitePasswordResult(null);
    expect(result).toEqual({ ok: true, next: ADMIN_INVITE_MFA_PATH });
    expect(result).toEqual({ ok: true, next: "/admin/security/mfa-setup" });
    expect(JSON.stringify(result)).not.toContain("/onboarding");
    expect(JSON.stringify(result)).not.toContain("/signup");
    expect(ADMIN_INVITE_PATH).toBe("/admin/accept");
  });

  it("keeps invitation acceptance off client onboarding and out of follow-up URLs", () => {
    const component = readFileSync(
      join(process.cwd(), "src/components/admin/admin-invite-accept.tsx"),
      "utf8",
    );
    const page = readFileSync(join(process.cwd(), "src/app/admin/accept/page.tsx"), "utf8");
    const proxy = readFileSync(join(process.cwd(), "src/proxy.ts"), "utf8");

    expect(component).not.toContain("/onboarding");
    expect(component).not.toContain("/signup");
    expect(component).not.toContain("/admin/clients");
    expect(component).toContain("ADMIN_INVITE_PATH");
    expect(component).toContain("updateUser");
    expect(component.indexOf("readAdminInviteIdentity")).toBeLessThan(
      component.indexOf("updateUser"),
    );
    expect(page).not.toContain("searchParams");
    expect(proxy).toContain("ADMIN_ROUTES.accept");
    expect(proxy).not.toContain('pathname.startsWith("/admin/accept")');
  });
});

describe("platform administrator password recovery", () => {
  const RECOVERY_ACCESS = "recovery-access-token";
  const RECOVERY_REFRESH = "recovery-refresh-token";
  const RECOVERY_CODE = "recovery-auth-code";
  const RECOVERY_HASH = "recovery-token-hash";

  it("accepts a recovery hash only after setSession succeeds", async () => {
    const auth = authDouble();
    const result = await establishAdminInviteSession(auth, {
      hash: `#access_token=${RECOVERY_ACCESS}&refresh_token=${RECOVERY_REFRESH}&type=recovery`,
      search: "",
    });

    expect(result).toEqual({ status: "ready", clearLocation: true, purpose: "recovery" });
    expect(auth.setSession).toHaveBeenCalledWith({
      access_token: RECOVERY_ACCESS,
      refresh_token: RECOVERY_REFRESH,
    });
    expect(auth.verifyOtp).not.toHaveBeenCalled();
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain(RECOVERY_ACCESS);
    expect(JSON.stringify(result)).not.toContain(RECOVERY_REFRESH);
  });

  it("verifies a recovery token hash with type recovery", async () => {
    const auth = authDouble();
    const result = await establishAdminInviteSession(auth, {
      hash: "",
      search: `?token_hash=${RECOVERY_HASH}&type=recovery`,
    });

    expect(result).toEqual({ status: "ready", clearLocation: true, purpose: "recovery" });
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: RECOVERY_HASH,
      type: "recovery",
    });
    expect(auth.setSession).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain(RECOVERY_HASH);
  });

  it("exchanges a recovery authorization code", async () => {
    const auth = authDouble();
    const result = await establishAdminInviteSession(auth, {
      hash: "",
      search: `?code=${RECOVERY_CODE}&type=recovery`,
    });

    expect(result).toMatchObject({ status: "ready", purpose: "recovery" });
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith(RECOVERY_CODE);
    expect(auth.verifyOtp).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain(RECOVERY_CODE);
  });

  it("rejects an expired or invalid recovery token without echoing it", async () => {
    const auth = authDouble();
    auth.verifyOtp.mockResolvedValue({
      error: { message: `otp expired for ${RECOVERY_HASH}` },
    } as never);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await establishAdminInviteSession(auth, {
      hash: "",
      search: `?token_hash=${RECOVERY_HASH}&type=recovery`,
    });

    expect(result).toEqual({
      status: "rejected",
      reason: "invalid",
      message: ADMIN_RECOVERY_INVALID,
      clearLocation: true,
      purpose: "recovery",
    });
    expect(JSON.stringify(result)).not.toContain(RECOVERY_HASH);
    expect(log).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();

    log.mockRestore();
    info.mockRestore();
    error.mockRestore();
  });

  it("does not call Auth for a malformed recovery hash", async () => {
    const auth = authDouble();
    const result = await establishAdminInviteSession(auth, {
      hash: `#access_token=${RECOVERY_ACCESS}&type=recovery`,
      search: "",
    });

    expect(result).toMatchObject({
      status: "rejected",
      reason: "invalid",
      message: ADMIN_RECOVERY_INVALID,
      clearLocation: false,
      purpose: "recovery",
    });
    expect(auth.setSession).not.toHaveBeenCalled();
    expect(auth.verifyOtp).not.toHaveBeenCalled();
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("keeps a non-admin or suspended administrator off the password form", () => {
    expect(adminInviteEligibility(null)).toBe("deny");
    expect(adminInviteEligibility({ role: "super_admin", status: "suspended" })).toBe("deny");
    expect(adminAcceptNotAdminMessage("recovery")).toBe(ADMIN_RECOVERY_NOT_ADMIN);
    expect(adminAcceptNotAdminMessage("invite")).not.toBe(ADMIN_RECOVERY_NOT_ADMIN);
  });

  it("uses the same password rules and sends recovery only to MFA setup", () => {
    expect(adminInvitePasswordInput("password12", "other-pass")).toEqual({
      ok: false,
      message: "Passwords do not match.",
    });
    expect(adminInvitePasswordInput("short", "short").ok).toBe(false);

    const failed = adminInvitePasswordResult({ message: "update failed for password12" });
    expect(failed).toEqual({
      ok: false,
      message: "The password could not be saved. Try a different one.",
    });
    expect(JSON.stringify(failed)).not.toContain("password12");

    const saved = adminInvitePasswordResult(null);
    expect(saved).toEqual({ ok: true, next: "/admin/security/mfa-setup" });
    expect(saved).toEqual({ ok: true, next: ADMIN_INVITE_MFA_PATH });
    expect(JSON.stringify(saved)).not.toContain("/onboarding");
  });
});
