import { getDb } from "@/db/client";
import { posts, postLinks, postTags, tags, categories } from "@/db/schema";
import { eq, ne } from "drizzle-orm";
import { extractEntities } from "@/services/research/dedupe";

export interface LinkTarget {
  id: string;
  title: string;
  slug: string;
  category?: string | null;
  tags?: string[];
  keywords: string[];
}

export interface InjectedLink {
  toPostId: string;
  targetSlug: string;
  anchor: string;
}

export interface LinkInjectionResult {
  enrichedMd: string;
  injectedLinks: InjectedLink[];
}

/**
 * Derives rich, high-signal search anchor phrases from a post's title, tags, and tech entities.
 */
export function extractTargetKeywords(
  title: string,
  tagsList: string[] = [],
): string[] {
  const keywords = new Set<string>();

  // 1. Tech entities from title
  const entities = extractEntities(title);
  for (const ent of entities) {
    if (ent.length >= 3) {
      keywords.add(ent);
    }
  }

  // 2. High-signal phrases from title
  const cleanTitle = title
    .replace(/[\[\(][^\]\)]*[\]\)]/g, " ") // remove [TEST] or (parens)
    .replace(/[|:–—\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Multi-word sub-phrases from title
  const titleWords = cleanTitle.split(" ").filter((w) => w.length > 2);
  if (titleWords.length >= 2) {
    for (let i = 0; i < titleWords.length - 1; i++) {
      const bigram = `${titleWords[i]} ${titleWords[i + 1]}`.trim();
      if (bigram.length > 7 && !/^(the|and|for|with|from|this|that|into|how|why)\s/i.test(bigram)) {
        keywords.add(bigram);
      }
    }
  }

  // 3. Meaningful tags
  for (const t of tagsList) {
    const cleanTag = t.replace(/-/g, " ").trim();
    if (cleanTag.length >= 4 && !["tech", "news", "ai", "guide"].includes(cleanTag.toLowerCase())) {
      keywords.add(cleanTag);
    }
  }

  // Sort longest first to prioritize specific multi-word phrases over single words
  return Array.from(keywords).sort((a, b) => b.length - a.length);
}

/**
 * Injects 2 to 4 contextual internal links into Markdown prose without altering
 * code blocks, inline code, headings, blockquotes, tables, or existing links.
 */
export function injectContextualInternalLinks(
  contentMd: string,
  currentPostSlug: string,
  targets: LinkTarget[],
  maxLinks: number = 3,
): LinkInjectionResult {
  if (!contentMd || targets.length === 0 || maxLinks <= 0) {
    return { enrichedMd: contentMd, injectedLinks: [] };
  }

  // Filter out self-links
  const eligibleTargets = targets.filter(
    (t) => t.slug !== currentPostSlug && t.keywords.length > 0,
  );

  if (eligibleTargets.length === 0) {
    return { enrichedMd: contentMd, injectedLinks: [] };
  }

  const injectedLinks: InjectedLink[] = [];
  const linkedTargetSlugs = new Set<string>();

  // Split markdown into lines while tracking fenced code blocks
  const lines = contentMd.split("\n");
  let inCodeBlock = false;

  const processedLines = lines.map((line) => {
    // Check code fence
    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      return line;
    }

    // Skip if inside code block, or line is heading, table row, quote, or image
    if (
      inCodeBlock ||
      line.trim().startsWith("#") ||
      line.trim().startsWith("|") ||
      line.trim().startsWith(">") ||
      line.trim().startsWith("![") ||
      line.trim().length < 40 // Skip very short lines/headers
    ) {
      return line;
    }

    if (injectedLinks.length >= maxLinks) {
      return line;
    }

    // Attempt to inject links into this paragraph
    let currentLine = line;

    for (const target of eligibleTargets) {
      if (injectedLinks.length >= maxLinks) break;
      if (linkedTargetSlugs.has(target.slug)) continue;

      for (const keyword of target.keywords) {
        if (linkedTargetSlugs.has(target.slug)) break;

        // Escape regex special characters in keyword
        const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

        // Match keyword with word boundaries, NOT inside existing markdown link [..](..) or inline code `..`
        // We use a regex that looks for word boundary, avoiding characters already part of links
        const regex = new RegExp(`(?<!\\[[^\\]]*)(?<!\`[^\`]*)\\b(${escapedKeyword})\\b(?![^\\[]*\\])(?![^\`]*\`)`, "i");

        const match = currentLine.match(regex);
        if (match && match.index !== undefined) {
          const matchedText = match[1];
          // Check that it's not already linked in currentLine
          const linkSyntax = `[${matchedText}](/blog/${target.slug})`;

          currentLine =
            currentLine.slice(0, match.index) +
            linkSyntax +
            currentLine.slice(match.index + matchedText.length);

          linkedTargetSlugs.add(target.slug);
          injectedLinks.push({
            toPostId: target.id,
            targetSlug: target.slug,
            anchor: matchedText,
          });
          break; // Move to next target
        }
      }
    }

    return currentLine;
  });

  return {
    enrichedMd: processedLines.join("\n"),
    injectedLinks,
  };
}

/**
 * Fetches all published posts from the database and constructs candidate LinkTarget list.
 */
export async function fetchPublishedLinkTargets(
  excludeSlug?: string,
): Promise<LinkTarget[]> {
  try {
    const db = getDb();
    const query = db
      .select({
        id: posts.id,
        title: posts.title,
        slug: posts.slug,
        categoryName: categories.name,
      })
      .from(posts)
      .leftJoin(categories, eq(posts.categoryId, categories.id))
      .where(eq(posts.status, "published"));

    const allPublished = await query;

    // Fetch tags for these posts
    const allTags = await db
      .select({
        postId: postTags.postId,
        tagName: tags.name,
      })
      .from(postTags)
      .leftJoin(tags, eq(postTags.tagId, tags.id));

    const tagsByPostId = new Map<string, string[]>();
    for (const t of allTags) {
      if (t.postId && t.tagName) {
        const list = tagsByPostId.get(t.postId) || [];
        list.push(t.tagName);
        tagsByPostId.set(t.postId, list);
      }
    }

    return allPublished
      .filter((p) => !excludeSlug || p.slug !== excludeSlug)
      .map((p) => {
        const postTagsList = tagsByPostId.get(p.id) || [];
        const keywords = extractTargetKeywords(p.title, postTagsList);
        return {
          id: p.id,
          title: p.title,
          slug: p.slug,
          category: p.categoryName,
          tags: postTagsList,
          keywords,
        };
      });
  } catch (err) {
    console.warn(`⚠️ [InternalLinks] Failed to fetch link targets: ${(err as Error).message}`);
    return [];
  }
}

/**
 * Inserts injected internal links into post_links table.
 */
export async function recordPostLinks(
  fromPostId: string,
  injectedLinks: InjectedLink[],
): Promise<number> {
  if (injectedLinks.length === 0) return 0;

  try {
    const db = getDb();
    const rows = injectedLinks.map((link) => ({
      fromPostId,
      toPostId: link.toPostId,
      anchor: link.anchor,
      type: "auto" as const,
    }));

    await db.insert(postLinks).values(rows);
    return rows.length;
  } catch (err) {
    console.warn(`⚠️ [InternalLinks] Failed to record post links: ${(err as Error).message}`);
    return 0;
  }
}
