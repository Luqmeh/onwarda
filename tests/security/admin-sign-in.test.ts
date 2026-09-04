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

  it("redirects a platform administrator to /admin", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "admin-user" } },
        }),
        signOut: vi.fn(),
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
    } as never);

    await expect(signInAction({}, createForm("/admin"))).rejects.toThrow(
      "NEXT_REDIRECT:/admin",
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
