const ORGANIZATION_ACCESS_PATH =
  /^\/o\/[a-z0-9]+(?:-[a-z0-9]+)*(?:[/?#].*)?$/;

export function safeInternalPath(value: string | undefined, fallback: string) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    value.includes("://")
  ) {
    return fallback;
  }

  if (value.includes("..")) {
    return fallback;
  }

  if (
    value.startsWith("/admin") ||
    value.startsWith("/app") ||
    value === "/login" ||
    value.startsWith("/signup") ||
    value.startsWith("/pricing") ||
    value.startsWith("/contact") ||
    ORGANIZATION_ACCESS_PATH.test(value)
  ) {
    return value;
  }

  return fallback;
}
