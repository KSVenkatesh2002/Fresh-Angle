/**
 * Formats a Date object or ISO string into a human-readable format (e.g., "Nov 1, 2026").
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "";

  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

/**
 * Returns ISO 8601 string for machine-readable <time dateTime="..."> and JSON-LD schema.
 */
export function formatIsoDate(date: Date | string | null | undefined): string {
  if (!date) return new Date().toISOString();

  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return new Date().toISOString();

  return d.toISOString();
}

/**
 * Formats a Date into a relative time string (e.g. "3 hours ago", "yesterday").
 */
export function formatRelativeTime(
  date: Date | string | null | undefined,
): string {
  if (!date) return "";

  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";

  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;

  return formatDate(d);
}
