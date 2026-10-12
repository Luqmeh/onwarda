import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authorization/platform-admin", () => ({
  requirePlatformAdmin: vi.fn(),
}));

vi.mock("@/lib/database/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { requirePlatformAdmin } from "@/lib/authorization/platform-admin";
import { createSupabaseServerClient } from "@/lib/database/server";
import { startAdminTotpEnrollment } from "@/lib/admin/mfa-actions";

const staleFactor = {
  id: "stale-factor",
  factor_type: "totp" as const,
  status: "unverified" as const,
};

const verifiedFactor = {
  id: "verified-factor",
  factor_type: "totp" as const,
  status: "verified" as const,
};

function mockFactors(
  all: Array<{ id: string; factor_type: "totp" | "phone"; status: "verified" | "unverified" }>,
  unenrollError: { message: string } | null = null,
) {
  const unenroll = vi.fn(async () => ({ error: unenrollError }));
  const enroll = vi.fn(async () => ({
    data: {
      id: "new-factor",
      totp: {
        qr_code: "data:image/svg+xml;base64,new-qr",
        secret: "new-setup-key",
      },
    },
    error: null,
  }));

  vi.mocked(createSupabaseServerClient).mockResolvedValue({
    auth: {
      mfa: {
        listFactors: vi.fn(async () => ({
          data: {
            all,
            totp: all.filter((factor) => factor.status === "verified"),
          },
          error: null,
        })),
        unenroll,
        enroll,
      },
    },
  } as never);

  return { unenroll, enroll };
}

describe("admin TOTP enrollment cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requirePlatformAdmin).mockResolvedValue({ user: { id: "admin-user" } } as never);
  });

  it("removes unverified TOTP factors before creating a new one", async () => {
    const { unenroll, enroll } = mockFactors([
      staleFactor,
      { id: "phone-factor", factor_type: "phone", status: "unverified" },
    ]);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const result = await startAdminTotpEnrollment();

    expect(unenroll).toHaveBeenCalledTimes(1);
    expect(unenroll).toHaveBeenCalledWith({ factorId: "stale-factor" });
    expect(unenroll).not.toHaveBeenCalledWith({ factorId: "phone-factor" });
    expect(enroll).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ factorId: "new-factor" });
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("does not remove a verified factor or create another one", async () => {
    const { unenroll, enroll } = mockFactors([verifiedFactor, staleFactor]);

    const result = await startAdminTotpEnrollment();

    expect(unenroll).not.toHaveBeenCalled();
    expect(enroll).not.toHaveBeenCalled();
    expect(result).toEqual({
      error: "An authenticator is already enrolled. Enter a code to continue.",
    });
  });

  it("stops enrollment when clearing a stale factor fails", async () => {
    const { unenroll, enroll } = mockFactors([staleFactor], { message: "remove failed" });

    const result = await startAdminTotpEnrollment();

    expect(unenroll).toHaveBeenCalledWith({ factorId: "stale-factor" });
    expect(enroll).not.toHaveBeenCalled();
    expect(result).toEqual({
      error: "The previous authenticator setup could not be cleared. No new code was created.",
    });
    expect(JSON.stringify(result)).not.toContain("remove failed");
    expect(JSON.stringify(result)).not.toContain("new-setup-key");
  });
});
