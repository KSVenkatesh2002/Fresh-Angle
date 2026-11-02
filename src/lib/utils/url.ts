const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "ref",
  "source",
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "_hsenc",
  "_hsmi",
]);

/**
 * Normalizes a URL:
 * - Lowercases hostname
 * - Strips leading 'www.'
 * - Removes tracking and utm parameters
 * - Strips hash/fragment
 * - Removes trailing slash
 */
export function normalizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl.trim());

    // Lowercase and strip www.
    let host = url.hostname.toLowerCase();
    if (host.startsWith("www.")) {
      host = host.slice(4);
    }
    url.hostname = host;

    // Remove tracking params
    const keysToDelete: string[] = [];
    url.searchParams.forEach((_, key) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey.startsWith("utm_") || TRACKING_PARAMS.has(lowerKey)) {
        keysToDelete.push(key);
      }
    });
    for (const key of keysToDelete) {
      url.searchParams.delete(key);
    }

    // Sort remaining query params for determinism
    url.searchParams.sort();

    // Remove hash
    url.hash = "";

    let result = url.toString();
    // Strip trailing slash if path ends with / and is not just protocol://host/
    if (result.endsWith("/") && url.pathname !== "/") {
      result = result.slice(0, -1);
    }

    return result;
  } catch {
    return rawUrl.trim().toLowerCase().replace(/\/$/, "");
  }
}
