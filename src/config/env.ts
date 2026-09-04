import { z } from "zod";

import { DEFAULT_APP_URL } from "@/config/app";

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.url().default(DEFAULT_APP_URL),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

function readPublicEnvValues() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL,
  };
}

let publicEnv: PublicEnv | undefined;

export function getPublicEnv(): PublicEnv {
  if (!publicEnv) {
    const parsed = publicEnvSchema.safeParse(readPublicEnvValues());

    if (!parsed.success) {
      throw new Error(
        "Invalid public environment configuration. Check NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and NEXT_PUBLIC_APP_URL.",
      );
    }

    publicEnv = parsed.data;
  }

  return publicEnv;
}

export function resetEnvCache() {
  publicEnv = undefined;
}
