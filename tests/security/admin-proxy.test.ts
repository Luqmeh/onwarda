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

  it("leaves /admin/accept reachable before a session exists and preserves the invite query", async () => {
    const passthrough = NextResponse.next();
    vi.mocked(updateSession).mockResolvedValue({
      response: passthrough,
      user: null,
    });

    const response = await proxy(
      requestFor("/admin/accept?token_hash=invite-token-hash&type=invite"),
    );

    expect(response).toBe(passthrough);
    expect(response.headers.get("location")).toBeNull();
  });

  it("leaves /admin/accept reachable for a recovery link and does not copy the token", async () => {
    const passthrough = NextResponse.next();
    vi.mocked(updateSession).mockResolvedValue({
      response: passthrough,
      user: null,
    });

    const response = await proxy(
      requestFor("/admin/accept?token_hash=recovery-token-hash&type=recovery"),
    );

    expect(response).toBe(passthrough);
    expect(response.headers.get("location")).toBeNull();

    const protectedResponse = await proxy(
      requestFor("/admin/clients?token_hash=recovery-token-hash&type=recovery"),
    );
    const location = protectedResponse.headers.get("location") ?? "";

    expect(protectedResponse.status).toBe(307);
    expect(location).not.toContain("recovery-token-hash");
  });

  it("still protects other admin routes and does not copy invite secrets into the login redirect", async () => {
    const passthrough = NextResponse.next();
    vi.mocked(updateSession).mockResolvedValue({
      response: passthrough,
      user: null,
    });

    const response = await proxy(requestFor("/admin/clients?token_hash=invite-token-hash"));
    const location = response.headers.get("location") ?? "";

    expect(response.status).toBe(307);
    expect(new URL(location, "http://localhost:3000").pathname).toBe("/admin/login");
    expect(location).not.toContain("invite-token-hash");
  });

  it("does not send an existing session away from /admin/accept", async () => {
    const passthrough = NextResponse.next();
    vi.mocked(updateSession).mockResolvedValue({
      response: passthrough,
      user: { id: "admin-user" } as never,
    });

    const response = await proxy(requestFor("/admin/accept"));

    expect(response).toBe(passthrough);
    expect(response.headers.get("location")).toBeNull();
  });

  it("leaves /admin/forgot-password reachable before a session exists", async () => {
    const passthrough = NextResponse.next();
    vi.mocked(updateSession).mockResolvedValue({
      response: passthrough,
      user: null,
    });

    const response = await proxy(requestFor("/admin/forgot-password?code=recovery-code"));

    expect(response).toBe(passthrough);
    expect(response.headers.get("location")).toBeNull();
  });

  it("does not copy a recovery code from another admin route into the login redirect", async () => {
    const passthrough = NextResponse.next();
    vi.mocked(updateSession).mockResolvedValue({
      response: passthrough,
      user: null,
    });

    const response = await proxy(requestFor("/admin/settings?code=recovery-code"));
    const location = response.headers.get("location") ?? "";

    expect(response.status).toBe(307);
    expect(location).not.toContain("recovery-code");
  });

  it("does not exempt a nested path under /admin/forgot-password", async () => {
    const passthrough = NextResponse.next();
    vi.mocked(updateSession).mockResolvedValue({
      response: passthrough,
      user: null,
    });

    const response = await proxy(requestFor("/admin/forgot-password/extra"));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") ?? "", "http://localhost:3000").pathname).toBe(
      "/admin/login",
    );
  });

  it("does not exempt a nested path under /admin/accept", async () => {
    const passthrough = NextResponse.next();
    vi.mocked(updateSession).mockResolvedValue({
      response: passthrough,
      user: null,
    });

    const response = await proxy(requestFor("/admin/accept/extra"));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") ?? "", "http://localhost:3000").pathname).toBe(
      "/admin/login",
    );
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
