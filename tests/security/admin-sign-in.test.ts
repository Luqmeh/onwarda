import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
}));

vi.mock("@/lib/database/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { signInAction } from "@/lib/auth/actions";
import { createSupabaseServerClient } from "@/lib/database/server";

function createForm(next: string, email = "owner@example.com") {
  const formData = new FormData();
  formData.set("email", email);
  formData.set("password", "password12");
  formData.set("next", next);
  return formData;
}

describe("admin sign-in", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("signs out a client user who tries to enter /admin", async () => {
    const signOut = vi.fn();
    const from = vi.fn(() => {
      const builder: Record<string, unknown> = {};
      const self = () => builder;
      builder.select = vi.fn(self);
      builder.eq = vi.fn(self);
      builder.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
      return builder;
    });

    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "client-user" } },
        }),
        signOut,
      },
      from,
    } as never);

    const result = await signInAction({}, createForm("/admin"));

    expect(result).toEqual({
      error: "Platform administrator access is required.",
    });
    expect(from).toHaveBeenCalledWith("platform_admins");
    expect(signOut).toHaveBeenCalled();
  });

  function adminClient(verified: boolean, currentLevel: "aal1" | "aal2") {
    return {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "admin-user", email: "admin@onwarda.com" } },
        }),
        signOut: vi.fn(),
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn(async () => ({
            data: { currentLevel, nextLevel: "aal2" },
            error: null,
          })),
          listFactors: vi.fn(async () => ({
            data: {
              totp: verified ? [{ id: "factor-1", status: "verified" }] : [],
            },
            error: null,
          })),
        },
      },
      from: vi.fn(() => {
        const builder: Record<string, unknown> = {};
        const self = () => builder;
        builder.select = vi.fn(self);
        builder.eq = vi.fn(self);
        builder.maybeSingle = vi.fn(async () => ({
          data: { id: "admin-row" },
          error: null,
        }));
        return builder;
      }),
    };
  }

  it("redirects a platform administrator with aal2 to /admin", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(adminClient(true, "aal2") as never);

    await expect(signInAction({}, createForm("/admin"))).rejects.toThrow(
      "NEXT_REDIRECT:/admin",
    );
  });

  it("sends an aal1 platform administrator to authenticator setup or challenge", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(adminClient(false, "aal1") as never);

    await expect(signInAction({}, createForm("/admin"))).rejects.toThrow(
      "NEXT_REDIRECT:/admin/security/mfa-setup?next=%2Fadmin",
    );

    vi.mocked(createSupabaseServerClient).mockResolvedValue(adminClient(true, "aal1") as never);

    await expect(signInAction({}, createForm("/admin/clients"))).rejects.toThrow(
      "NEXT_REDIRECT:/admin/security/mfa-challenge?next=%2Fadmin%2Fclients",
    );
  });

  it("does not apply the admin gate to client workspace login", async () => {
    const from = vi.fn();
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
        getUser: vi.fn(),
        signOut: vi.fn(),
      },
      from,
    } as never);

    await expect(signInAction({}, createForm("/app"))).rejects.toThrow(
      "NEXT_REDIRECT:/app",
    );
    expect(from).not.toHaveBeenCalled();
  });
});
