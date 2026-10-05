const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const DEVELOPMENT_APP_URL = "http://localhost:3000";

export class AppUrlConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppUrlConfigurationError";
  }
}

export type AppUrlInput = {
  configuredUrl?: string | null;
  nodeEnv?: string | null;
  vercelEnv?: string | null;
  vercelUrl?: string | null;
};

/** Origin only: protocol, host, and port. No path, query, or trailing slash. */
export function normalizeAppOrigin(value: string) {
  let url: URL;

  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }

  if (url.username || url.password) {
    return null;
  }

  return url.origin;
}

export function isLocalAppOrigin(origin: string) {
  try {
    return LOCAL_HOSTS.has(new URL(origin).hostname);
  } catch {
    return false;
  }
}

function present(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Explicit NEXT_PUBLIC_APP_URL wins in every environment.
 * Production never invents localhost or the deployment-specific Vercel hostname.
 * Preview may use VERCEL_URL only when no explicit origin is configured.
 * Development is the only environment that may fall back to localhost.
 */
export function resolveAppUrl(input: AppUrlInput = {}) {
  const configured = present(input.configuredUrl);
  const vercelEnv = present(input.vercelEnv);
  const nodeEnv = present(input.nodeEnv) ?? "development";

  if (configured) {
    const origin = normalizeAppOrigin(configured);

    if (!origin) {
      throw new AppUrlConfigurationError(
        "NEXT_PUBLIC_APP_URL must be an absolute http(s) origin, such as https://onwarda-3bux.vercel.app.",
      );
    }

    if (vercelEnv === "production" && isLocalAppOrigin(origin)) {
      throw new AppUrlConfigurationError(
        "NEXT_PUBLIC_APP_URL must not be localhost when VERCEL_ENV is production.",
      );
    }

    return origin;
  }

  if (vercelEnv === "preview") {
    const previewHost = present(input.vercelUrl);
    const origin = previewHost
      ? normalizeAppOrigin(previewHost.includes("://") ? previewHost : `https://${previewHost}`)
      : null;

    if (!origin || isLocalAppOrigin(origin)) {
      throw new AppUrlConfigurationError(
        "Preview deployments need VERCEL_URL or NEXT_PUBLIC_APP_URL. Refusing to fall back to localhost.",
      );
    }

    return origin;
  }

  if (vercelEnv === "production" || nodeEnv === "production") {
    throw new AppUrlConfigurationError(
      "NEXT_PUBLIC_APP_URL is required in production. Refusing to fall back to localhost.",
    );
  }

  return DEVELOPMENT_APP_URL;
}

export function readAppUrlInput(): AppUrlInput {
  return {
    configuredUrl: process.env.NEXT_PUBLIC_APP_URL,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV,
    vercelUrl: process.env.VERCEL_URL || process.env.NEXT_PUBLIC_VERCEL_URL,
  };
}

let cachedAppUrl: string | undefined;

export function getAppUrl() {
  if (!cachedAppUrl) {
    cachedAppUrl = resolveAppUrl(readAppUrlInput());
  }

  return cachedAppUrl;
}

export function resetAppUrlCache() {
  cachedAppUrl = undefined;
}

/** Join a root-relative path onto a normalized origin. Query strings are preserved. */
export function buildAppUrl(origin: string, path: string) {
  const base = normalizeAppOrigin(origin);

  if (!base) {
    throw new AppUrlConfigurationError("Application origin is not a valid http(s) URL.");
  }

  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\") || path.includes("://")) {
    throw new AppUrlConfigurationError("Application paths must be root-relative.");
  }

  const url = new URL(path, `${base}/`);

  if (url.origin !== base) {
    throw new AppUrlConfigurationError("Application paths must stay on the application origin.");
  }

  return url.toString();
}

export function authRedirectUrl(path = "/login") {
  return buildAppUrl(getAppUrl(), path);
}
