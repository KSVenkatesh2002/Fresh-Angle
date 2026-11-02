import { slugify } from "@/lib/utils/slug";

export interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

/**
 * Parses markdown text to extract H2 and H3 headings for the Table of Contents.
 */
export function extractTableOfContents(markdown: string): TocItem[] {
  if (!markdown) return [];

  const items: TocItem[] = [];
  // Regex matches lines starting with ## or ### (ignoring code fences)
  const lines = markdown.split("\n");
  let insideCodeBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      insideCodeBlock = !insideCodeBlock;
      continue;
    }

    if (insideCodeBlock) {
      continue;
    }

    const h2Match = trimmed.match(/^##\s+(.+)$/);
    if (h2Match && h2Match[1]) {
      const text = h2Match[1].replace(/[*_`]/g, "").trim();
      items.push({
        id: slugify(text),
        text,
        level: 2,
      });
      continue;
    }

    const h3Match = trimmed.match(/^###\s+(.+)$/);
    if (h3Match && h3Match[1]) {
      const text = h3Match[1].replace(/[*_`]/g, "").trim();
      items.push({
        id: slugify(text),
        text,
        level: 3,
      });
    }
  }

  return items;
}
