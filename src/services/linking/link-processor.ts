import { inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { posts } from "@/db/schema";

export interface ValidatedLink {
  targetPostId: string;
  slug: string;
  anchor: string;
}

export interface LinkProcessingResult {
  cleanedMarkdown: string;
  links: ValidatedLink[];
}

export async function processInternalLinks(
  markdown: string,
): Promise<LinkProcessingResult> {
  const db = getDb();
  const linkRegex =
    /\[([^\]]+)\]\((?:\/blog\/|https?:\/\/[^/]+\/blog\/)([a-zA-Z0-9_-]+)\)/g;

  // Extract all matches
  const extracted: Array<{ fullMatch: string; anchor: string; slug: string }> =
    [];
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(markdown)) !== null) {
    extracted.push({
      fullMatch: match[0],
      anchor: match[1],
      slug: match[2],
    });
  }

  if (extracted.length === 0) {
    return { cleanedMarkdown: markdown, links: [] };
  }

  // Query database for valid slugs
  const uniqueSlugs = Array.from(new Set(extracted.map((e) => e.slug)));
  const validPosts = await db
    .select({ id: posts.id, slug: posts.slug })
    .from(posts)
    .where(inArray(posts.slug, uniqueSlugs));

  const postMap = new Map(validPosts.map((p) => [p.slug, p.id]));
  const seenSlugs = new Set<string>();
  const validatedLinks: ValidatedLink[] = [];

  // Replace links line by line to prevent links in headers and duplicate target links
  const lines = markdown.split("\n");
  const cleanedLines = lines.map((line) => {
    // Check if line is a header
    const isHeading = /^#{1,6}\s+/.test(line.trim());

    return line.replace(linkRegex, (fullMatch, anchor, slug) => {
      // If inside heading, strip link markup
      if (isHeading) return anchor;

      const targetId = postMap.get(slug);
      // If slug doesn't exist in DB, strip link
      if (!targetId) return anchor;

      // If already linked to this slug in earlier paragraph, keep anchor only (max 1 link per target)
      if (seenSlugs.has(slug)) return anchor;

      seenSlugs.add(slug);
      validatedLinks.push({ targetPostId: targetId, slug, anchor });
      return fullMatch;
    });
  });

  return {
    cleanedMarkdown: cleanedLines.join("\n"),
    links: validatedLinks,
  };
}
