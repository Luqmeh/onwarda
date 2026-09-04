import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/config/env.server";

/**
 * Service-role access bypasses RLS. Use it only for:
 * - platform-admin aggregate metrics and client directory, only after requirePlatformAdmin()
 * - Auth Admin invitation/lookup during provisioning (GoTrue has no user-scoped invite API)
 * - guest token hash lookup
 * - private signed URLs
 *
 * Organization inserts and status changes go through SECURITY DEFINER RPCs that
 * check is_active_platform_admin(). Do not insert tenant rows with this client.
 *
 * Every tenant-data operation must still authorize in application code
 * before this client is used. Never import this module from the browser.
 */
export function createServiceRoleClient() {
  const env = getServerEnv();

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
