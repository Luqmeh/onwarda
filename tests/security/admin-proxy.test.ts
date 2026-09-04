import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/proxy-session", () => ({
  updateSession: vi.fn(),
}));

import { updateSession } from "@/lib/auth/proxy-session";
import { proxy } from "@/proxy";

function requestFor(path: string) {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

describe("admin proxy authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends unauthenticated /admin requests to /admin/login", async () => {
    const passthrough = NextResponse.next();
    vi.mocked(updateSession).mockResolvedValue({
      response: passthrough,
      user: null,
    });

    const response = await proxy(requestFor("/admin/clients"));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") ?? "", "http://localhost:3000");
    expect(location.pathname).toBe("/admin/login");
    expect(location.searchParams.get("next")).toBe("/admin/clients");
  });

  it("does not treat an authenticated session as platform-admin authorization", async () => {
    const passthrough = NextResponse.next();
    vi.mocked(updateSession).mockResolvedValue({
      response: passthrough,
      user: { id: "client-user" } as never,
    });

    const response = await proxy(requestFor("/admin"));

    expect(response).toBe(passthrough);
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects an authenticated visitor away from /admin/login toward /admin", async () => {
    const passthrough = NextResponse.next();
    vi.mocked(updateSession).mockResolvedValue({
      response: passthrough,
      user: { id: "anyone" } as never,
    });

    const response = await proxy(requestFor("/admin/login"));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") ?? "", "http://localhost:3000").pathname).toBe(
      "/admin",
    );
  });
});
