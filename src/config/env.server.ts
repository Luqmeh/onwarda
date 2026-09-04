import "server-only";

import { getPublicEnv, serverEnvSchema, type ServerEnv } from "@/config/env";

let serverEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (!serverEnv) {
    const parsed = serverEnvSchema.safeParse({
      ...getPublicEnv(),
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    });

    if (!parsed.success) {
      throw new Error(
        "Invalid server environment configuration. SUPABASE_SERVICE_ROLE_KEY is required on the server and must never be exposed to the browser.",
      );
    }

    serverEnv = parsed.data;
  }

  return serverEnv;
}
