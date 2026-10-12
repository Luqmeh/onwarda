import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  ADMIN_FORGOT_PASSWORD_PATH,
  CLIENT_FORGOT_PASSWORD_PATH,
  RECOVERY_CODE_INVALID_MESSAGE,
  RECOVERY_REQUEST_MESSAGE,
  passwordChangeOutcome,
  recoveryCodeInput,
  recoveryLoginPath,
  recoveryPasswordInput,
  recoveryPasswordOutcome,
  recoveryRequestOutcome,
  requestPasswordRecovery,
  verifyPasswordRecoveryCode,
} from "@/lib/auth/password-recovery";

const EMAIL = "person@example.com";
const CODE = "123456";
const PASSWORD = "password12";

function authDouble() {
  return {
    resetPasswordForEmail: vi.fn(async () => ({ error: null })),
    verifyOtp: vi.fn(async () => ({ error: null })),
  };
}

describe("password recovery codes", () => {
  it("points each login audience at its own recovery page and fresh login", () => {
    expect(CLIENT_FORGOT_PASSWORD_PATH).toBe("/forgot-password");
    expect(ADMIN_FORGOT_PASSWORD_PATH).toBe("/admin/forgot-password");
    expect(recoveryLoginPath("client")).toBe("/login");
    expect(recoveryLoginPath("admin")).toBe("/admin/login");
    expect(recoveryLoginPath("admin")).not.toBe("/admin");
    expect(recoveryLoginPath("client")).not.toContain("/app");
  });

  it("requests recovery through resetPasswordForEmail and hides whether the account exists", async () => {
    const auth = authDouble();
    const sent = await requestPasswordRecovery(auth, EMAIL);
    expect(sent).toEqual({ status: "sent", message: RECOVERY_REQUEST_MESSAGE });
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith(EMAIL);

    const unknown = recoveryRequestOutcome({
      message: `User not found: ${EMAIL}`,
      code: "user_not_found",
    });
    expect(unknown.status).toBe("sent");
    expect(JSON.stringify(unknown)).not.toContain(EMAIL);

    const limited = recoveryRequestOutcome({
      message: `too many requests for ${EMAIL}`,
      code: "over_email_send_rate_limit",
      status: 429,
    });
    expect(limited.status).toBe("wait");
    expect(JSON.stringify(limited)).not.toContain(EMAIL);
  });

  it("verifies a recovery code with type recovery and rejects invalid codes before Auth", async () => {
    const auth = authDouble();
    const verified = await verifyPasswordRecoveryCode(auth, EMAIL, CODE);
    expect(verified).toEqual({ ok: true });
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: EMAIL,
      token: CODE,
      type: "recovery",
    });
    expect(JSON.stringify(verified)).not.toContain(CODE);

    auth.verifyOtp.mockClear();
    const malformed = await verifyPasswordRecoveryCode(auth, EMAIL, "12");
    expect(malformed.ok).toBe(false);
    expect(auth.verifyOtp).not.toHaveBeenCalled();

    auth.verifyOtp.mockResolvedValue({
      error: { message: `otp expired for ${CODE}` },
    } as never);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const expired = await verifyPasswordRecoveryCode(auth, EMAIL, "654321");
    expect(expired).toEqual({ ok: false, message: RECOVERY_CODE_INVALID_MESSAGE });
    expect(JSON.stringify(expired)).not.toContain("654321");
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("rejects a reused or incorrect code without echoing it", async () => {
    const auth = authDouble();
    auth.verifyOtp.mockResolvedValue({
      error: { message: `token already used ${CODE}`, code: "otp_expired" },
    } as never);
    const result = await verifyPasswordRecoveryCode(auth, EMAIL, CODE);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(CODE);
    expect(recoveryCodeInput("signup-token").ok).toBe(false);
  });

  it("rejects a password mismatch and a password-policy failure without echoing the password", () => {
    expect(recoveryPasswordInput(PASSWORD, "other-pass12")).toEqual({
      ok: false,
      message: "Passwords do not match.",
    });
    expect(recoveryPasswordInput("short", "short").ok).toBe(false);

    const failed = recoveryPasswordOutcome(
      { message: `weak password ${PASSWORD}` },
      PASSWORD,
    );
    expect(failed).toEqual({
      ok: false,
      message: "The password could not be saved. Try a different one.",
    });
    expect(JSON.stringify(failed)).not.toContain(PASSWORD);
    expect(recoveryPasswordOutcome(null, PASSWORD)).toEqual({ ok: true });
  });

  it("hides passwords and reauthentication codes from change results", () => {
    const failed = passwordChangeOutcome(
      { message: `bad nonce ${CODE} for ${PASSWORD}` },
      { password: PASSWORD, nonce: CODE },
    );
    expect(failed.ok).toBe(false);
    expect(JSON.stringify(failed)).not.toContain(CODE);
    expect(JSON.stringify(failed)).not.toContain(PASSWORD);
    expect(passwordChangeOutcome(null, { password: PASSWORD, nonce: CODE }).ok).toBe(true);
  });

  it("keeps recovery pages, codes, and passwords out of urls, logs, and analytics", () => {
    const recovery = readFileSync(
      join(process.cwd(), "src/components/auth/password-recovery-form.tsx"),
      "utf8",
    );
    const change = readFileSync(
      join(process.cwd(), "src/components/auth/password-change-form.tsx"),
      "utf8",
    );
    const login = readFileSync(join(process.cwd(), "src/app/login/page.tsx"), "utf8");
    const adminLogin = readFileSync(join(process.cwd(), "src/app/admin/login/page.tsx"), "utf8");
    const proxy = readFileSync(join(process.cwd(), "src/proxy.ts"), "utf8");
    const recoveryLib = readFileSync(
      join(process.cwd(), "src/lib/auth/password-recovery.ts"),
      "utf8",
    );

    const invite = readFileSync(join(process.cwd(), "src/lib/auth/admin-invite.ts"), "utf8");

    expect(login).toContain("recoveryHref={CLIENT_FORGOT_PASSWORD_PATH}");
    expect(adminLogin).toContain("recoveryHref={ADMIN_FORGOT_PASSWORD_PATH}");
    expect(recovery).toContain("requestPasswordRecovery");
    expect(recovery).toContain("verifyPasswordRecoveryCode");
    expect(recoveryLib).toContain("resetPasswordForEmail");
    expect(recoveryLib).toContain('type: "recovery"');
    expect(recovery).toContain("signOut");
    expect(recovery).toContain("readAdminInviteIdentity");
    expect(recovery).not.toContain("localStorage");
    expect(recovery).not.toContain("router.push");
    expect(recovery).not.toContain("/onboarding");
    expect(recovery).not.toContain("/signup");
    expect(recovery).not.toContain("console.log");
    expect(change).toContain("reauthenticate");
    expect(change).toContain("nonce:");
    expect(change.indexOf("authorizePasswordChange")).toBeLessThan(change.indexOf("updateUser"));
    expect(change).not.toContain("localStorage");
    expect(change).not.toContain("console.log");
    expect(proxy).toContain("ADMIN_ROUTES.forgotPassword");
    expect(proxy).not.toContain('pathname.startsWith("/admin/forgot-password")');
    expect(proxy).not.toContain('"/g/"');
    expect(proxy).not.toContain('"/cleaner"');
    expect(invite).toContain('type: "invite"');
    expect(invite).toContain('"recovery"');
  });
});
