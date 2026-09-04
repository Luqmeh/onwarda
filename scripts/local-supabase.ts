import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

export function parseDotEnv(content: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const index = line.indexOf("=");

    if (index <= 0) {
      continue;
    }

    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

export function applyDotEnvLocal(cwd = process.cwd()): string {
  const filePath = resolve(cwd, ".env.local");

  if (!existsSync(filePath)) {
    throw new Error(
      "Missing .env.local. Local bootstrap commands read credentials from that file.",
    );
  }

  const parsed = parseDotEnv(readFileSync(filePath, "utf8"));

  for (const [key, value] of Object.entries(parsed)) {
    process.env[key] = value;
  }

  return filePath;
}

export function isLocalSupabaseUrl(value: string): boolean {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();

  if (
    hostname.endsWith(".supabase.co") ||
    hostname.endsWith(".supabase.net") ||
    hostname.endsWith(".supabase.com")
  ) {
    return false;
  }

  return LOOPBACK_HOSTS.has(hostname);
}

export function assertLocalSupabaseUrl(value: string): URL {
  if (!isLocalSupabaseUrl(value)) {
    throw new Error(
      "Local bootstrap only runs against local development Supabase (127.0.0.1 or localhost). Refusing a hosted or production project.",
    );
  }

  return new URL(value);
}
