import * as cheerio from "cheerio";
import { fetchWithRetry } from "@/lib/utils/http";
import { PIPELINE_CONFIG } from "@/config/pipeline";

export interface ExtractedArticleSource {
  url: string;
  title: string;
  publisher: string;
  content: string;
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
 * Fetches an article webpage and extracts the main clean text content using Cheerio.
 */
export async function extractArticleContent(
  url: string,
  fallbackTitle?: string,
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

    // Truncate to limit
    const charLimit = PIPELINE_CONFIG.limits.articleTextCharLimit;
    const cleanContent =
      extractedText.length > charLimit
        ? `${extractedText.substring(0, charLimit)}...`
        : extractedText;

    return {
      url,
      title,
      publisher,
      content: cleanContent,
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
