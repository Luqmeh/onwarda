import { describe, expect, it } from "vitest";

import { publicEnvSchema, serverEnvSchema } from "@/config/env";

describe("environment validation", () => {
  it("accepts a complete public configuration", () => {
    const parsed = publicEnvSchema.parse({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    });

    expect(parsed.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
  });

  it("rejects a missing anon key", () => {
    const parsed = publicEnvSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
    });

    expect(parsed.success).toBe(false);
  });

  it("requires the service role key on the server", () => {
    const parsed = serverEnvSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    });

    expect(parsed.success).toBe(false);
  });
});
