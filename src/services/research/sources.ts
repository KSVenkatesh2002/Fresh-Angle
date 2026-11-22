import * as cheerio from "cheerio";
import { fetchWithRetry } from "@/lib/utils/http";
import { PIPELINE_CONFIG } from "@/config/pipeline";

export interface ExtractedArticleSource {
  url: string;
  title: string;
  publisher: string;
  content: string;
  headings?: string[];
  role?: "primary" | "academic_baseline" | "community_discussion";
}

export interface ExtractArticleOptions {
  maxChars?: number;
  extractHeadings?: boolean;
}

/**
 * Derives a clean publisher name from an article URL.
 */
export function extractPublisherFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    const parts = host.split(".");
    if (parts.length >= 2) {
      const name = parts[0];
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
    return host;
  } catch {
    return "Web Source";
  }
}

/**
 * Cleans web-scraped and extracted text by stripping boilerplate navigation,
 * login links, markdown image tags, repeated pipe banners, and cookie notices.
 */
export function stripBoilerplate(text: string): string {
  if (!text) return "";
  return text
    // Strip markdown images: ![alt](url)
    .replace(/!\[[^\]]*\]\([^\)]+\)/g, " ")
    // Strip markdown navigation links (Login, Subscribe, Sign in, Menu, etc.)
    .replace(/\[\s*(login|sign in|sign up|register|subscribe|home|privacy policy|terms of service|cookie policy|share|menu|navigation)\s*\]\([^\)]+\)/gi, " ")
    // Strip list items with single link navigation: * [Login](/...)
    .replace(/^[\s*\-•]\s*\[[^\]]+\]\([^\)]+\)\s*$/gm, " ")
    // Strip empty table pipe rows used for header navigation: | | | | |---|---|---|
    .replace(/^[\|\s\-:]+$/gm, " ")
    // Strip common disclaimer/cookie banner lines
    .replace(/^.*(cookie policy|gdpr|all rights reserved|copyright ©|subscribe to unlock).*$/gim, " ")
    // Collapse multiple empty lines
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Caps repeated markdown links to the same destination URL.
 * Keeps at most maxPerUrl instances as links [text](url), and strips the hyperlink
 * from subsequent instances leaving just plain anchor text, preventing spammy appearance.
 */
export function capRepeatedUrlLinks(markdown: string, maxPerUrl: number = 2): string {
  if (!markdown) return "";
  const urlCounts = new Map<string, number>();
  return markdown.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, (match, anchorText, url) => {
    const cleanUrl = url.trim().toLowerCase();
    const count = urlCounts.get(cleanUrl) || 0;
    if (count >= maxPerUrl) {
      return anchorText;
    }
    urlCounts.set(cleanUrl, count + 1);
    return match;
  });
}

export interface CitationAnalysis {
  distinctUrls: number;
  totalLinks: number;
  linksPerUrl: Record<string, number>;
}

export function analyzeCitations(markdown: string): CitationAnalysis {
  const matches = Array.from(markdown.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g));
  const linksPerUrl: Record<string, number> = {};
  let totalLinks = 0;
  for (const match of matches) {
    const url = match[2].trim().toLowerCase();
    linksPerUrl[url] = (linksPerUrl[url] || 0) + 1;
    totalLinks++;
  }
  return {
    distinctUrls: Object.keys(linksPerUrl).length,
    totalLinks,
    linksPerUrl,
  };
}

/**
 * Fetches an article webpage and extracts the main clean text content using Cheerio.
 * Supports options.maxChars (0 or Infinity for full text) and options.extractHeadings.
 */
export async function extractArticleContent(
  url: string,
  fallbackTitle?: string,
  options?: ExtractArticleOptions,
): Promise<ExtractedArticleSource> {
  const publisher = extractPublisherFromUrl(url);

  try {
    const response = await fetchWithRetry(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 FreshAngleBot/1.0",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        timeoutMs: PIPELINE_CONFIG.limits.httpTimeoutMs,
      },
      { retries: 2, backoffMs: 1000 },
    );

    if (!response.ok) {
      throw new Error(`HTTP status ${response.status} from ${url}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract headings before removing anything, if requested
    const headings: string[] = [];
    if (options?.extractHeadings) {
      $("h1, h2, h3").each((_, elem) => {
        const text = $(elem).text().trim().replace(/\s+/g, " ");
        if (text.length > 5 && text.length < 120) {
          headings.push(text);
        }
      });
    }

    // Remove noise: scripts, styles, forms, navs, footers, sidebars, cookie banners
    $(
      "script, style, noscript, nav, header, footer, aside, form, svg, iframe, .ads, .advertisement, #comments, .comments, .cookie-banner, .social-share",
    ).remove();

    // Extract title
    let title =
      $('meta[property="og:title"]').attr("content") ||
      $("title").text().trim() ||
      fallbackTitle ||
      "Article Source";

    // Remove site name suffixes from title
    title = title.split(/[|–-]/)[0].trim();

    // Target primary article content container
    const contentSelectors = [
      "article",
      '[role="main"]',
      "main",
      ".post-content",
      ".article-content",
      ".entry-content",
      "#content",
    ];

    let extractedText = "";
    for (const selector of contentSelectors) {
      const el = $(selector);
      if (el.length > 0) {
        // Collect text from paragraphs and headings
        const paragraphs: string[] = [];
        el.find("p, h2, h3").each((_, elem) => {
          const text = $(elem).text().trim();
          if (text.length > 30) {
            paragraphs.push(text);
          }
        });

        if (paragraphs.length > 2) {
          extractedText = paragraphs.join("\n\n");
          break;
        }
      }
    }

    // Fallback: extract all p tags
    if (!extractedText) {
      const paragraphs: string[] = [];
      $("p").each((_, elem) => {
        const text = $(elem).text().trim();
        if (text.length > 30) {
          paragraphs.push(text);
        }
      });
      extractedText = paragraphs.slice(0, 15).join("\n\n");
    }

    // Apply char limit only if maxChars is not 0 or Infinity
    const charLimit =
      options?.maxChars !== undefined
        ? (options.maxChars === 0 ? Infinity : options.maxChars)
        : PIPELINE_CONFIG.limits.articleTextCharLimit;

    const sanitizedText = stripBoilerplate(extractedText);

    const cleanContent =
      Number.isFinite(charLimit) && sanitizedText.length > charLimit
        ? `${sanitizedText.substring(0, charLimit)}...`
        : sanitizedText;

    return {
      url,
      title,
      publisher,
      content: cleanContent,
      headings: headings.length > 0 ? headings : undefined,
    };
  } catch (err: unknown) {
    console.warn(
      `⚠️ [Research] Failed to extract article from ${url}: ${(err as Error).message}`,
    );
    return {
      url,
      title: fallbackTitle || "Reference Document",
      publisher,
      content: `Source article could not be fully parsed: ${(err as Error).message}`,
    };
  }
}

/**
 * Extracts high-signal technical keywords from a topic title for search queries.
 */
function extractSearchKeywords(title: string): string {
  const stopWords = new Set([
    "a", "an", "the", "in", "on", "for", "with", "how", "why", "what", "is",
    "are", "and", "or", "of", "to", "via", "using", "from", "at", "by", "this",
    "that", "into", "introducing", "announcing", "new", "released", "launch"
  ]);

  const clean = title
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !stopWords.has(w.toLowerCase()));

  return clean.slice(0, 4).join(" ");
}

/**
 * Discovers 1-2 secondary research sources (academic papers via ArXiv or developer discussions via Hacker News)
 * to triangulate technical claims, eliminate single-source paraphrasing, and guarantee originality.
 */
export async function discoverSecondarySources(
  topicTitle: string,
  excludeUrl?: string,
): Promise<ExtractedArticleSource[]> {
  const searchTerms = extractSearchKeywords(topicTitle);
  if (!searchTerms) {
    return [];
  }

  const secondarySources: ExtractedArticleSource[] = [];

  try {
    const excludeHost = excludeUrl ? new URL(excludeUrl).hostname.replace(/^www\./, "") : "";

    // Run parallel discovery: ArXiv (academic context) + Hacker News (industry/community context)
    const [arxivResult, hnResult] = await Promise.allSettled([
      // 1. ArXiv Search API
      (async () => {
        const arxivUrl = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(searchTerms)}&start=0&max_results=2`;
        const res = await fetchWithRetry(
          arxivUrl,
          { timeoutMs: 5000 },
          { retries: 1, backoffMs: 500 },
        );
        if (!res.ok) return [];
        const xml = await res.text();
        const $ = cheerio.load(xml, { xmlMode: true });
        const items: ExtractedArticleSource[] = [];

        $("entry").each((_, entry) => {
          const entryTitle = $(entry).find("title").text().replace(/\s+/g, " ").trim();
          const entrySummary = $(entry).find("summary").text().replace(/\s+/g, " ").trim();
          const entryId = $(entry).find("id").text().trim();

          if (entrySummary.length > 150 && entryTitle) {
            items.push({
              url: entryId,
              title: entryTitle,
              publisher: "arXiv Technical Paper",
              content: entrySummary,
              role: "academic_baseline",
            });
          }
        });
        return items;
      })(),

      // 2. Hacker News Algolia Search API
      (async () => {
        const hnUrl = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(searchTerms)}&tags=story&hitsPerPage=3`;
        const res = await fetchWithRetry(
          hnUrl,
          { timeoutMs: 5000 },
          { retries: 1, backoffMs: 500 },
        );
        if (!res.ok) return [];
        const data = await res.json() as { hits?: Array<{ title?: string; url?: string }> };
        const hits = data.hits || [];
        const items: ExtractedArticleSource[] = [];

        for (const hit of hits) {
          if (!hit.url || !hit.title) continue;
          try {
            const hitHost = new URL(hit.url).hostname.replace(/^www\./, "");
            if (excludeHost && hitHost.includes(excludeHost)) continue;
            if (hit.url === excludeUrl) continue;

            const extracted = await extractArticleContent(hit.url, hit.title);
            if (extracted.content && extracted.content.length > 250 && !extracted.content.startsWith("Source article could not")) {
              items.push({
                ...extracted,
                role: "community_discussion",
              });
              if (items.length >= 1) break; // 1 external community article is plenty
            }
          } catch {
            // Ignore individual fetch errors
          }
        }
        return items;
      })(),
    ]);

    if (arxivResult.status === "fulfilled" && arxivResult.value.length > 0) {
      secondarySources.push(arxivResult.value[0]);
    }

    if (hnResult.status === "fulfilled" && hnResult.value.length > 0) {
      secondarySources.push(hnResult.value[0]);
    }
  } catch (err) {
    console.warn(`⚠️ [Research] Secondary source discovery failed gracefully: ${(err as Error).message}`);
  }

  return secondarySources;
}

