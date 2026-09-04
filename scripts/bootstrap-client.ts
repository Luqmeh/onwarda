import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

import {
  applyDotEnvLocal,
  assertLocalSupabaseUrl,
} from "./local-supabase";

type AdminClient = SupabaseClient;

const ALLOWED_ROLES = new Set(["owner", "admin", "manager", "staff"]);

function requiredValue(name: string, value: string | undefined): string {
  const trimmed = value?.trim();

  if (!trimmed) {
    throw new Error(
      `Missing ${name}. Set it in .env.local or pass it as a CLI argument.`,
    );
  }

  return trimmed;
}

function readArg(name: string): string | undefined {
  const index = process.argv.findIndex((arg) => arg === `--${name}`);

  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

function isAlreadyRegistered(error: {
  code?: string;
  message?: string;
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

async function assertNotPlatformAdmin(admin: AdminClient, userId: string) {
  const { data, error } = await admin
    .from("platform_admins")
    .select("id, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to read platform_admins: ${error.message}`);
  }

  if (data) {
    throw new Error(
      "That Auth user is a platform administrator and cannot be attached as a client user.",
    );
  }
}

async function attachToOrganization(
  admin: AdminClient,
  userId: string,
  organizationId: string,
  role: string,
) {
  const { data: memberships, error } = await admin
    .from("organization_users")
    .select("id, organization_id, role, status")
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Unable to read organization_users: ${error.message}`);
  }

  const foreign = (memberships ?? []).find(
    (row) => row.organization_id !== organizationId,
  );

  if (foreign) {
    throw new Error(
      "That user already belongs to a different organization and will not be attached across tenants.",
    );
  }

  const existing = (memberships ?? []).find(
    (row) => row.organization_id === organizationId,
  );

  if (!existing) {
    const inserted = await admin.from("organization_users").insert({
      organization_id: organizationId,
      user_id: userId,
      role,
      status: "active",
    });

    if (inserted.error) {
      throw new Error(
        `Unable to attach the client user: ${inserted.error.message}`,
      );
    }

    return;
  }

  if (existing.role === role && existing.status === "active") {
    return;
  }

  const updated = await admin
    .from("organization_users")
    .update({ role, status: "active" })
    .eq("id", existing.id)
    .eq("organization_id", organizationId);

  if (updated.error) {
    throw new Error(
      `Unable to update the existing membership: ${updated.error.message}`,
    );
  }
}

async function verifyClientSignIn(
  url: string,
  anonKey: string,
  email: string,
  password: string,
  organizationId: string,
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
    throw new Error("Normal Supabase Auth sign-in failed for the local client user.");
  }

  const { data: membership, error: membershipError } = await userClient
    .from("organization_users")
    .select("organization_id, role, status")
    .eq("user_id", data.user.id)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError || !membership) {
    throw new Error(
      "The signed-in user has no active organization membership visible under RLS.",
    );
  }

  if (membership.organization_id !== organizationId) {
    throw new Error(
      "The signed-in user resolved a different organization than the selected tenant.",
    );
  }

  await userClient.auth.signOut();
}

async function main() {
  applyDotEnvLocal();

  const url = requiredValue(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
  const anonKey = requiredValue(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const serviceRoleKey = requiredValue(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const email = requiredValue(
    "ONWARDA_DEV_CLIENT_EMAIL",
    readArg("email") ?? process.env.ONWARDA_DEV_CLIENT_EMAIL,
  ).toLowerCase();
  const password = requiredValue(
    "ONWARDA_DEV_CLIENT_PASSWORD",
    readArg("password") ?? process.env.ONWARDA_DEV_CLIENT_PASSWORD,
  );
  const orgSlug = (
    readArg("org") ??
    process.env.ONWARDA_DEV_CLIENT_ORG_SLUG ??
    "riad-atlas"
  )
    .trim()
    .toLowerCase();
  const role = (
    readArg("role") ??
    process.env.ONWARDA_DEV_CLIENT_ROLE ??
    "owner"
  )
    .trim()
    .toLowerCase();

  if (!ALLOWED_ROLES.has(role)) {
    throw new Error("Role must be one of owner, admin, manager, or staff.");
  }

  assertLocalSupabaseUrl(url);
  await assertLocalSupabaseRunning(url, anonKey);

  const admin = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: organization, error: organizationError } = await admin
    .from("organizations")
    .select("id, name, slug, status")
    .eq("slug", orgSlug)
    .maybeSingle();

  if (organizationError) {
    throw new Error(`Unable to look up the organization: ${organizationError.message}`);
  }

  if (!organization) {
    throw new Error(`No organization found with slug "${orgSlug}".`);
  }

  const { user, created } = await createOrReuseAuthUser(admin, email, password);
  await ensureProfile(admin, user.id, email);
  await assertNotPlatformAdmin(admin, user.id);
  await attachToOrganization(admin, user.id, organization.id, role);
  await verifyClientSignIn(url, anonKey, email, password, organization.id);

  console.log("Local Onwarda client user ready:");
  console.log(email);
  console.log(`${organization.name} (${organization.slug}) · ${role}`);
  console.log(created ? "Auth user: created" : "Auth user: reused");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error.";
  console.error(message);
  process.exitCode = 1;
});
