/**
 * Validates that a post-login redirect target is a safe relative path
 * on this origin, preventing open-redirect vulnerabilities.
 */
export function sanitizeRedirectPath(
  raw: string | null | undefined,
  fallback = "/admin",
): string {
  if (!raw || typeof raw !== "string") {
    return fallback;
  }

  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return fallback;
  }

  if (trimmed.includes("\\") || /[\u0000-\u001F\u007F]/.test(trimmed)) {
    return fallback;
  }

  try {
    const parsed = new URL(trimmed, "http://localhost");
    if (parsed.origin !== "http://localhost") {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
