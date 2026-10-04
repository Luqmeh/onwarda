import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

const LOADER = "src/lib/calendar/load.ts";
const MODEL = "src/lib/calendar/model.ts";
const CALENDAR_UI = "src/components/workspace/operations-calendar.tsx";
const REFRESH_UI = "src/components/workspace/calendar-refresh.tsx";
const CALENDAR_PAGE = "src/app/app/calendar/page.tsx";
const OVERVIEW_PAGE = "src/app/app/page.tsx";

describe("calendar tenant scope", () => {
  it("takes the organization from the authenticated workspace view, never from the caller", () => {
    const loader = read(LOADER);

    expect(loader).toContain("requireWorkspaceView");
    expect(loader).toContain("const organizationId = view.context.organization.id");
    expect(loader).not.toMatch(/organizationId\s*:\s*string/);
    expect(loader).not.toContain("options.organizationId");
  });

  it("scopes every calendar query to that organization", () => {
    const loader = read(LOADER);
    const tables = [...loader.matchAll(/\.from\("([a-z_]+)"\)/g)].map((match) => match[1]);
    const scopes = [...loader.matchAll(/\.eq\("organization_id", organizationId\)/g)];

    expect(tables).toEqual(["properties", "reservations", "cleaning_tasks"]);
    expect(scopes).toHaveLength(tables.length);
  });

  it("reads through the user-scoped client so RLS stays authoritative", () => {
    const loader = read(LOADER);

    expect(loader).toContain("createSupabaseServerClient");
    expect(loader).not.toContain("createServiceRoleClient");
    expect(loader).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("keeps the calendar read-only and free of its own tables", () => {
    const loader = read(LOADER);

    for (const mutation of [".insert(", ".update(", ".upsert(", ".delete(", ".rpc("]) {
      expect(loader, mutation).not.toContain(mutation);
    }

    for (const table of ["calendar_reservations", "calendar_properties", "calendar_bookings", "calendar_cleaning_states"]) {
      expect(loader, table).not.toContain(table);
    }
  });

  it("bounds calendar queries by the visible date window", () => {
    const loader = read(LOADER);

    expect(loader).toContain('.lte("check_in", range.end)');
    expect(loader).toContain('.gt("check_out", range.start)');
    expect(loader).toContain("created_at.gte.${range.start}");
    expect(loader).toContain(".limit(400)");
  });
});

describe("calendar url parameters", () => {
  it("treats view and date as UI state only", () => {
    const model = read(MODEL);

    expect(model).toContain("DATE_KEY_PATTERN");
    expect(model).toContain('candidate === "week" ? "week" : "month"');

    for (const page of [read(CALENDAR_PAGE), read(OVERVIEW_PAGE)]) {
      expect(page).toContain("resolveCalendarView");
      expect(page).toContain("resolveCalendarAnchor");
      expect(page).not.toContain("organizationId");
      expect(page).not.toMatch(/searchParams.*organization/i);
    }
  });
});

describe("calendar client surface", () => {
  it("never ships service-role credentials or a cross-tenant subscription", () => {
    for (const file of [CALENDAR_UI, REFRESH_UI]) {
      const source = read(file);

      expect(source, file).not.toContain("createServiceRoleClient");
      expect(source, file).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
      expect(source, file).not.toContain(".channel(");
      expect(source, file).not.toContain("postgres_changes");
      expect(source, file).not.toContain("organization_id");
    }
  });

  it("refreshes through the server render rather than a direct database subscription", () => {
    const refresh = read(REFRESH_UI);

    expect(refresh).toContain("router.refresh()");
    expect(refresh).not.toContain("createClient");
    expect(refresh).not.toContain("fetch(");
  });

  it("does not leak guest contact details into the calendar", () => {
    const loader = read(LOADER);
    const ui = read(CALENDAR_UI);

    expect(loader).not.toContain("email");
    expect(loader).not.toContain("phone");
    expect(ui).not.toContain("email");
    expect(ui).not.toContain("phone");
    expect(ui).not.toContain("console.log");
  });

  it("links only to existing workspace routes", () => {
    const model = read(MODEL);

    expect(model).toContain("clientReservationPath");
    expect(model).toContain("cleaningTaskPath");
    expect(model).toContain("clientPropertyPath");
    expect(model).not.toContain("/cleaner/");
    expect(model).not.toContain("/g/");
  });
});
