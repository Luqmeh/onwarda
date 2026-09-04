import { Client, type ClientConfig } from "pg";

export const LOCAL_DB_URL =
  process.env.SUPABASE_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export function createPostgresClient(config: ClientConfig = {}) {
  return new Client({
    connectionString: LOCAL_DB_URL,
    ...config,
  });
}

export async function requireLocalPostgres() {
  const client = createPostgresClient();

  try {
    await client.connect();
    const result = await client.query<{ ok: number }>(
      "select 1 as ok from pg_extension where extname = 'pgcrypto'",
    );

    if (result.rowCount !== 1) {
      throw new Error("Local PostgreSQL is running but pgcrypto is missing.");
    }

    return client;
  } catch (error) {
    await client.end().catch(() => undefined);
    throw new Error(
      `Local Supabase PostgreSQL is required for RLS tests. ${
        error instanceof Error ? error.message : "Unknown connection error."
      }`,
    );
  }
}

export async function asAuthenticated<T>(
  client: Client,
  userId: string,
  work: () => Promise<T>,
): Promise<T> {
  await client.query("begin");

  try {
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [
      userId,
    ]);
    await client.query(
      "select set_config('request.jwt.claim.role', 'authenticated', true)",
    );
    await client.query(
      "select set_config('request.jwt.claims', $1, true)",
      [JSON.stringify({ sub: userId, role: "authenticated" })],
    );
    await client.query("set local role authenticated");
    return await work();
  } finally {
    await client.query("rollback");
  }
}

export async function asAnon<T>(
  client: Client,
  work: () => Promise<T>,
): Promise<T> {
  await client.query("begin");

  try {
    await client.query("set local role anon");
    return await work();
  } finally {
    await client.query("rollback");
  }
}
