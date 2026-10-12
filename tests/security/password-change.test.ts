import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authorization/platform-admin", () => ({
  getPlatformAdminContext: vi.fn(),
  requireActivePlatformAdminWithMfa: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireUser: vi.fn(),
}));

import { authorizePasswordChange, validateChosenPassword } from "@/lib/auth/password-change-actions";
import { PASSWORD_POLICY_MESSAGE } from "@/lib/auth/password-recovery";
import { requireUser } from "@/lib/auth/session";
import {
  getPlatformAdminContext,
  requireActivePlatformAdminWithMfa,
} from "@/lib/authorization/platform-admin";
import { AuthenticationError, AuthorizationError } from "@/lib/errors";

describe("signed-in password changes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires an active platform administrator at aal2 before an admin password change", async () => {
    vi.mocked(requireActivePlatformAdminWithMfa).mockResolvedValue({} as never);

    await expect(authorizePasswordChange("admin")).resolves.toEqual({ ok: true });
    expect(requireActivePlatformAdminWithMfa).toHaveBeenCalledOnce();
    expect(requireUser).not.toHaveBeenCalled();
  });

  it("does not authorize an admin password change below aal2", async () => {
    vi.mocked(requireActivePlatformAdminWithMfa).mockRejectedValue(
      new AuthorizationError("Multi-factor authentication is required."),
    );

    await expect(authorizePasswordChange("admin")).resolves.toEqual({
      ok: false,
      message: "Verify your authenticator before changing this password.",
    });
  });

  it("lets a signed-in client change only their own password", async () => {
    vi.mocked(requireUser).mockResolvedValue({ id: "client-user" } as never);
    vi.mocked(getPlatformAdminContext).mockResolvedValue(null);

    await expect(authorizePasswordChange("client")).resolves.toEqual({ ok: true });
    expect(requireActivePlatformAdminWithMfa).not.toHaveBeenCalled();
  });

  it("still requires authenticator assurance when the signed-in client is a platform administrator", async () => {
    vi.mocked(requireUser).mockResolvedValue({ id: "admin-user" } as never);
    vi.mocked(getPlatformAdminContext).mockResolvedValue({ admin: { role: "super_admin" } } as never);
    vi.mocked(requireActivePlatformAdminWithMfa).mockRejectedValue(
      new AuthorizationError("Multi-factor authentication is required."),
    );

    await expect(authorizePasswordChange("client")).resolves.toEqual({
      ok: false,
      message: "Verify your authenticator before changing this password.",
    });
  });

  it("rejects a signed-out password change", async () => {
    vi.mocked(requireUser).mockRejectedValue(new AuthenticationError());

    await expect(authorizePasswordChange("client")).resolves.toEqual({
      ok: false,
      message: "Sign in again before changing your password.",
    });
  });

  it("rejects a weak or mismatched password on the server without echoing it", async () => {
    vi.mocked(requireUser).mockResolvedValue({ id: "client-user" } as never);
    const weak = "password12";

    await expect(validateChosenPassword(weak, weak)).resolves.toEqual({
      ok: false,
      message: PASSWORD_POLICY_MESSAGE,
    });
    await expect(validateChosenPassword("Password12", "Password13")).resolves.toEqual({
      ok: false,
      message: "Passwords do not match.",
    });
    await expect(validateChosenPassword("Password12", "Password12")).resolves.toEqual({ ok: true });
    expect(JSON.stringify(await validateChosenPassword(weak, weak))).not.toContain(weak);
    expect(requireActivePlatformAdminWithMfa).not.toHaveBeenCalled();
  });
});
