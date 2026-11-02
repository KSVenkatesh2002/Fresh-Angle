/**
 * Converts any arbitrary string into a clean, URL-safe, lowercase slug.
 */
export function slugify(input: string): string {
  if (!input) return "";

  return input
    .normalize("NFD") // Normalize unicode
    .replace(/[\u0300-\u036f]/g, "") // Strip accents
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, "") // Strip leading/trailing hyphens
    .replace(/-{2,}/g, "-"); // Collapse multiple hyphens
}

/**
 * Generates a normalized topic key used for duplicate detection across dates/sources.
 */
export function generateTopicKey(title: string): string {
  const stopWords = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "has",
    "he",
    "in",
    "is",
    "it",
    "its",
    "of",
    "on",
    "that",
    "the",
    "to",
    "was",
    "were",
    "will",
    "with",
    "new",
    "how",
    "why",
    "what",
  ]);

  const clean = slugify(title);
  const words = clean
    .split("-")
    .filter((w) => w.length > 2 && !stopWords.has(w))
    .sort();

  return words.join("-");
}
