import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthorizationError } from "@/lib/errors";

vi.mock("@/lib/auth/session", () => ({
  requireUser: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/database/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/auth/proxy-session", () => ({
  updateSession: vi.fn(),
}));

import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/database/server";
import { updateSession } from "@/lib/auth/proxy-session";
import { proxy } from "@/proxy";
import {
  requireCurrentOrganization,
  requireOrganizationMembership,
} from "@/lib/tenancy/context";
import { getWorkspaceDashboard, listWorkspaceProperties } from "@/lib/workspace/data";

function createBuilder(result: unknown) {
  const builder: Record<string, unknown> = {};
  const self = () => builder;
  builder.select = vi.fn(self);
  builder.eq = vi.fn(self);
  builder.in = vi.fn(self);
  builder.gte = vi.fn(self);
  builder.order = vi.fn(self);
  builder.limit = vi.fn(self);
  builder.maybeSingle = vi.fn(async () => result);
  builder.then = (
    onFulfilled: (value: unknown) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(onFulfilled, onRejected);
  return builder;
}

function requestFor(path: string) {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

function walkSource(dir: string, files: string[] = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walkSource(full, files);
    } else if (full.endsWith(".ts") || full.endsWith(".tsx")) {
      files.push(full);
    }
  }
  return files;
}

const membership = {
  id: "mem-1",
  organization_id: "org-a",
  user_id: "user-a",
  role: "owner",
  status: "active",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const organization = {
  id: "org-a",
  name: "Riad Atlas",
  slug: "riad-atlas",
  legal_name: null,
  status: "active",
  subscription_status: "trial",
  onboarding_status: "in_progress",
  logo_url: null,
  primary_color: null,
  secondary_color: null,
  accent_color: null,
  website: null,
  phone: null,
  country: null,
  timezone: null,
  default_language: "en",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("client workspace authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends unauthenticated /app requests to /login", async () => {
    const passthrough = NextResponse.next();
    vi.mocked(updateSession).mockResolvedValue({
      response: passthrough,
      user: null,
    });

    const response = await proxy(requestFor("/app/properties"));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") ?? "", "http://localhost:3000");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/app/properties");
  });
});

describe("client membership resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireUser).mockResolvedValue({
      id: "user-a",
      email: "owner@example.com",
    });
  });

  it("rejects an authenticated user without an organization membership", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      from: vi.fn(() => createBuilder({ data: [], error: null })),
    } as never);

    await expect(requireCurrentOrganization()).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("does not trust a foreign organization id from the caller", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "organization_users") {
          return createBuilder({ data: [membership], error: null });
        }

        if (table === "organizations") {
          return createBuilder({ data: organization, error: null });
        }

        return createBuilder({ data: null, error: null });
      }),
    } as never);

    await expect(requireOrganizationMembership("org-b")).rejects.toThrow(
      /does not belong to the requested organization/,
    );
  });

  it("blocks a suspended organization", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "organization_users") {
          return createBuilder({ data: [membership], error: null });
        }

        if (table === "organizations") {
          return createBuilder({
            data: { ...organization, status: "suspended" },
            error: null,
          });
        }

        return createBuilder({ data: null, error: null });
      }),
    } as never);

    await expect(requireCurrentOrganization()).rejects.toThrow(/suspended/);
  });
});

describe("tenant-scoped workspace queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireUser).mockResolvedValue({
      id: "user-a",
      email: "owner@example.com",
    });
  });

  it("scopes dashboard queries to the resolved organization, never a client-supplied id", async () => {
    const eq = vi.fn();
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      from: vi.fn((table: string) => {
        const builder = createBuilder(
          table === "organization_users"
            ? { data: [membership], error: null }
            : table === "organizations"
              ? { data: organization, error: null }
              : { data: [], count: 0, error: null },
        );
        builder.eq = vi.fn((column: string, value: string) => {
          eq(column, value);
          return builder;
        });
        return builder;
      }),
    } as never);

    const dashboard = await getWorkspaceDashboard();

    expect(dashboard.organizationId).toBe("org-a");
    expect(eq).toHaveBeenCalledWith("organization_id", "org-a");
    expect(eq).not.toHaveBeenCalledWith("organization_id", "org-b");
    expect(dashboard.counts.properties).toBe(0);
  });

  it("loads the property list from the membership organization only", async () => {
    const eq = vi.fn();
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      from: vi.fn((table: string) => {
        const builder = createBuilder(
          table === "organization_users"
            ? { data: [membership], error: null }
            : table === "organizations"
              ? { data: organization, error: null }
              : { data: [], error: null },
        );
        builder.eq = vi.fn((column: string, value: string) => {
          eq(column, value);
          return builder;
        });
        return builder;
      }),
    } as never);

    await listWorkspaceProperties();
    expect(eq).toHaveBeenCalledWith("organization_id", "org-a");
  });
});

describe("client workspace source isolation", () => {
  const root = join(process.cwd(), "src");

  it("does not share the admin layout or requirePlatformAdmin", () => {
    const layout = readFileSync(join(root, "app/app/layout.tsx"), "utf8");
    expect(layout).toContain("requireCurrentOrganization");
    expect(layout).not.toContain("requirePlatformAdmin");
    expect(layout).not.toContain("AdminShell");
  });

  it("keeps workspace data loaders on the user-scoped client", () => {
    const data = readFileSync(join(root, "lib/workspace/data.ts"), "utf8");
    expect(data).toContain("requireCurrentOrganization");
    expect(data).toContain("createSupabaseServerClient");
    expect(data).not.toContain("createServiceRoleClient");
    expect(data).not.toContain("searchParams");
    expect(data).not.toContain("organizationId from");
  });

  it("does not import the service-role client from workspace or brand components", () => {
    const files = [
      ...walkSource(join(root, "components/workspace")),
      ...walkSource(join(root, "lib/workspace")),
      ...walkSource(join(root, "app/app")),
    ];

    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toContain("@/lib/database/admin");
      expect(source, file).not.toContain("createServiceRoleClient");
      expect(source, file).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    }
  });
});
