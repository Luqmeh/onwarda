import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

import {
  applyDotEnvLocal,
  assertLocalSupabaseUrl,
} from "./local-supabase";

type AdminClient = SupabaseClient;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing ${name} in .env.local.`);
  }

  return value;
}

function isAlreadyRegistered(error: {
  code?: string;
  message?: string;
  status?: number;
}): boolean {
  const message = error.message?.toLowerCase() ?? "";

  return (
    error.code === "email_exists" ||
    error.code === "user_already_exists" ||
    message.includes("already been registered") ||
    message.includes("already registered") ||
    message.includes("user already exists")
  );
}

async function assertLocalSupabaseRunning(
  url: string,
  anonKey: string,
): Promise<void> {
  const healthUrl = `${url.replace(/\/$/, "")}/auth/v1/health`;

  try {
    const response = await fetch(healthUrl, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Auth health check returned HTTP ${response.status}.`);
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error.";
    throw new Error(
      `Local Supabase is not reachable at ${url}. Start it with npx supabase start. ${detail}`,
    );
  }
}

async function findUserByEmail(
  admin: AdminClient,
  email: string,
): Promise<User | null> {
  const normalized = email.toLowerCase();
  let page = 1;

  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw new Error(`Unable to list Auth users: ${error.message}`);
    }

    const found = data.users.find(
      (user) => user.email?.toLowerCase() === normalized,
    );

    if (found) {
      return found;
    }

    if (data.users.length < 1000) {
      return null;
    }

    page += 1;
  }
}

async function createOrReuseAuthUser(
  admin: AdminClient,
  email: string,
  password: string,
): Promise<{ user: User; created: boolean }> {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (!created.error && created.data.user) {
    return { user: created.data.user, created: true };
  }

  if (!created.error || !isAlreadyRegistered(created.error)) {
    throw new Error(
      `Unable to create Auth user: ${created.error?.message ?? "Unknown error."}`,
    );
  }

  const existing = await findUserByEmail(admin, email);

  if (!existing) {
    throw new Error(
      "Auth reported the email already exists, but the user could not be found.",
    );
  }

  const updated = await admin.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
  });

  if (updated.error || !updated.data.user) {
    throw new Error(
      `Unable to update the existing Auth user: ${updated.error?.message ?? "Unknown error."}`,
    );
  }

  return { user: updated.data.user, created: false };
}

async function ensureProfile(
  admin: AdminClient,
  userId: string,
  email: string,
): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { data, error } = await admin
      .from("profiles")
      .select("id, email")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Unable to read profiles: ${error.message}`);
    }

    if (data) {
      if (data.email !== email) {
        const update = await admin
          .from("profiles")
          .update({ email })
          .eq("id", userId);

        if (update.error) {
          throw new Error(`Unable to update profile email: ${update.error.message}`);
        }
      }

      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const inserted = await admin.from("profiles").insert({ id: userId, email });

  if (inserted.error && inserted.error.code !== "23505") {
    throw new Error(`Unable to create profile: ${inserted.error.message}`);
  }
}

async function ensurePlatformAdmin(
  admin: AdminClient,
  userId: string,
): Promise<void> {
  const { data, error } = await admin
    .from("platform_admins")
    .select("id, status, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to read platform_admins: ${error.message}`);
  }

  if (!data) {
    const inserted = await admin.from("platform_admins").insert({
      user_id: userId,
      role: "super_admin",
      status: "active",
    });

    if (inserted.error) {
      throw new Error(
        `Unable to create platform_admins row: ${inserted.error.message}`,
      );
    }

    return;
  }

  if (data.status === "active" && data.role === "super_admin") {
    return;
  }

  const updated = await admin
    .from("platform_admins")
    .update({ status: "active", role: "super_admin" })
    .eq("user_id", userId);

  if (updated.error) {
    throw new Error(
      `Unable to activate platform_admins row: ${updated.error.message}`,
    );
  }
}

async function verifyRequirePlatformAdminWouldSucceed(
  url: string,
  anonKey: string,
  email: string,
  password: string,
): Promise<void> {
  const userClient = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await userClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    throw new Error(
      "Normal Supabase Auth sign-in failed for the local platform administrator.",
    );
  }

  const { data: adminRow, error: adminError } = await userClient
    .from("platform_admins")
    .select("id, status")
    .eq("user_id", data.user.id)
    .eq("status", "active")
    .maybeSingle();

  if (adminError || !adminRow) {
    throw new Error(
      "requirePlatformAdmin() would reject this account: no active platform_admins row is visible to the signed-in user.",
    );
  }

  const { data: isAdmin, error: rpcError } = await userClient.rpc(
    "is_active_platform_admin",
  );

  if (rpcError) {
    throw new Error(
      `Unable to evaluate is_active_platform_admin(): ${rpcError.message}`,
    );
  }

  if (isAdmin !== true) {
    throw new Error(
      "requirePlatformAdmin() would reject this account: is_active_platform_admin() returned false.",
    );
  }

  const { data: profile, error: profileError } = await userClient
    .from("profiles")
    .select("id")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    throw new Error(
      "requirePlatformAdmin() would reject this account: the signed-in user has no profile.",
    );
  }

  await userClient.auth.signOut();
}

async function main() {
  applyDotEnvLocal();

  const url = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const email = requiredEnv("ONWARDA_DEV_ADMIN_EMAIL").toLowerCase();
  const password = requiredEnv("ONWARDA_DEV_ADMIN_PASSWORD");

  assertLocalSupabaseUrl(url);
  await assertLocalSupabaseRunning(url, anonKey);

  const admin = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { user, created } = await createOrReuseAuthUser(admin, email, password);
  await ensureProfile(admin, user.id, email);
  await ensurePlatformAdmin(admin, user.id);
  await verifyRequirePlatformAdminWouldSucceed(url, anonKey, email, password);

  console.log("Local Onwarda platform admin ready:");
  console.log(email);
  console.log(created ? "Auth user: created" : "Auth user: reused");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error.";
  console.error(message);
  process.exitCode = 1;
});
