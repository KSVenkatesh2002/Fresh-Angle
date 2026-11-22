import { fetchWithRetry } from "@/lib/utils/http";
import { PIPELINE_CONFIG } from "@/config/pipeline";
import {
  ExtractedArticleSource,
  extractArticleContent,
  discoverSecondarySources,
} from "./sources";

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export interface TavilySearchOptions {
  searchDepth?: "basic" | "advanced";
  maxResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
}

export class TavilyClient {
  private apiKey: string;
  private baseUrl = "https://api.tavily.com";
  private timeoutMs = 10000;
  private queryCount = 0;
  private maxQueriesPerArticle = 3;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.TAVILY_API_KEY || "";
  }

  public isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.startsWith("tvly-"));
  }

  public resetQueryCount(): void {
    this.queryCount = 0;
  }

  public getQueryCount(): number {
    return this.queryCount;
  }

  public getMaxQueries(): number {
    return this.maxQueriesPerArticle;
  }

  /**
   * Executes a search query via Tavily Search API with bounded timeouts and retries.
   */
  async search(
    query: string,
    options?: TavilySearchOptions,
  ): Promise<TavilySearchResult[]> {
    if (!this.isAvailable()) {
      return [];
    }

    if (this.queryCount >= this.maxQueriesPerArticle) {
      console.warn(
        `⚠️ [Tavily] Per-article query limit (${this.maxQueriesPerArticle}) reached. Skipping query: "${query}"`,
      );
      return [];
    }

    this.queryCount++;

    const payload = {
      api_key: this.apiKey,
      query,
      search_depth: options?.searchDepth || "basic",
      include_answer: false,
      include_raw_content: false,
      max_results: options?.maxResults || 4,
      include_domains: options?.includeDomains || [],
      exclude_domains: options?.excludeDomains || [],
    };

    try {
      const response = await fetchWithRetry(
        `${this.baseUrl}/search`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          timeoutMs: this.timeoutMs,
        },
        {
          retries: 2,
          backoffMs: 1000,
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(
          `⚠️ [Tavily] Search API returned ${response.status}: ${errorText.slice(0, 150)}`,
        );
        return [];
      }

      const data = (await response.json()) as {
        results?: Array<{
          title?: string;
          url?: string;
          content?: string;
          score?: number;
        }>;
      };

      const results = (data.results || []).map((r) => ({
        title: r.title || "Untitled Source",
        url: r.url || "",
        content: r.content || "",
        score: r.score || 0,
      }));

      return results.filter((r) => r.url && r.content);
    } catch (err) {
      console.warn(
        `⚠️ [Tavily] Search request failed for "${query}": ${(err as Error).message}`,
      );
      return [];
    }
  }

  /**
   * Extracts raw article text and markdown from URLs via Tavily Extract API.
   * Useful when standard Cheerio scraping fails on JavaScript-rendered pages.
   */
  async extract(
    urls: string[],
  ): Promise<Map<string, { rawContent: string; images?: string[] }>> {
    const resultsMap = new Map<string, { rawContent: string; images?: string[] }>();

    if (!this.isAvailable() || urls.length === 0) {
      return resultsMap;
    }

    try {
      const response = await fetchWithRetry(
        `${this.baseUrl}/extract`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            api_key: this.apiKey,
            urls,
            extract_depth: "basic",
            include_images: false,
          }),
          timeoutMs: 15000,
        },
        {
          retries: 1,
          backoffMs: 1000,
        },
      );

      if (!response.ok) {
        return resultsMap;
      }

      const data = (await response.json()) as {
        results?: Array<{
          url?: string;
          raw_content?: string;
          images?: string[];
        }>;
      };

      for (const res of data.results || []) {
        if (res.url && res.raw_content) {
          resultsMap.set(res.url, {
            rawContent: res.raw_content,
            images: res.images || [],
          });
        }
      }
    } catch (err) {
      console.warn(
        `⚠️ [Tavily] Extract request failed: ${(err as Error).message}`,
      );
    }

    return resultsMap;
  }
}

/**
 * Extracts high-signal technical keywords from a topic title for targeted search queries.
 */
export function extractSearchKeywords(title: string): string {
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

import {
  BRAND_NAMES,
  extractDistinctiveTopicTerms,
  isResearchOrientedTopic,
  verifyRelevanceWithLLM,
  isRelevantSource,
} from "./relevance";

export {
  BRAND_NAMES,
  extractDistinctiveTopicTerms,
  isResearchOrientedTopic,
  verifyRelevanceWithLLM,
  isRelevantSource,
};

/**
 * Derives a clean hostname for domain deduplication.
 */
export function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Gathers 1-2 baseline/context sources and 1-2 practitioner/community sources
 * using Tavily Search with domain deduplication, paywall filtering, and graceful fallback.
 * Also supplements with arXiv and Hacker News for rich multi-pillar triangulation.
 */
export async function gatherMultiSourceResearch(
  topicTitle: string,
  primaryUrl?: string,
): Promise<{
  baselineSources: ExtractedArticleSource[];
  communitySources: ExtractedArticleSource[];
  allSources: ExtractedArticleSource[];
  researchDepth: "single" | "multi";
}> {
  const distinctiveTerms = extractDistinctiveTopicTerms(topicTitle);
  const keywords =
    (distinctiveTerms.length >= 2
      ? distinctiveTerms
      : extractSearchKeywords(topicTitle).split(" ")
    )
      .slice(0, 4)
      .join(" ");

  if (!keywords) {
    return {
      baselineSources: [],
      communitySources: [],
      allSources: [],
      researchDepth: "single",
    };
  }

  const client = new TavilyClient();
  const seenDomains = new Set<string>();
  const seenUrls = new Set<string>();

  if (primaryUrl) {
    const primaryDomain = getHostname(primaryUrl);
    if (primaryDomain) seenDomains.add(primaryDomain);
    seenUrls.add(primaryUrl);
  }

  const baselineSources: ExtractedArticleSource[] = [];
  const communitySources: ExtractedArticleSource[] = [];

  // Paywalled or low-value domains to exclude from automated retrieval
  const excludeDomains = [
    "wsj.com",
    "ft.com",
    "bloomberg.com",
    "theinformation.com",
    "nytimes.com",
  ];

  if (client.isAvailable()) {
    try {
      // 1. Query for Baseline / Contextual / Prior-Art Sources
      const baselineResults = await client.search(
        `${keywords} architecture overview technical documentation`,
        {
          searchDepth: "basic",
          maxResults: 3,
          excludeDomains,
        },
      );

      for (const r of baselineResults) {
        if (baselineSources.length >= 2) break;
        const domain = getHostname(r.url);
        if (!domain || seenDomains.has(domain) || seenUrls.has(r.url)) continue;
        const rel = await isRelevantSource(r, topicTitle);
        if (!rel.relevant) {
          console.log(`[Tavily] Dropped baseline candidate "${r.title}": ${rel.reason}`);
          continue;
        }

        let article = await extractArticleContent(r.url, r.title);
        if (
          !article.content ||
          article.content.startsWith("Source article could not") ||
          article.content.length < 200
        ) {
          if (r.content && r.content.length > 150) {
            article = {
              url: r.url,
              title: r.title,
              publisher: domain,
              content: r.content,
            };
          } else {
            continue;
          }
        }

        // Enforce secondary source char limit from PIPELINE_CONFIG
        if (article.content.length > PIPELINE_CONFIG.limits.secondarySourceCharLimit) {
          article.content = article.content.slice(
            0,
            PIPELINE_CONFIG.limits.secondarySourceCharLimit,
          );
        }

        article.role = "academic_baseline";
        seenDomains.add(domain);
        seenUrls.add(r.url);
        baselineSources.push(article);
      }

      // 2. Query for Practitioner / Community Critiques & Benchmark Discussions
      const communityResults = await client.search(
        `${keywords} review limitations benchmarks discussion`,
        {
          searchDepth: "basic",
          maxResults: 3,
          excludeDomains,
        },
      );

      for (const r of communityResults) {
        if (communitySources.length >= 2) break;
        const domain = getHostname(r.url);
        if (!domain || seenDomains.has(domain) || seenUrls.has(r.url)) continue;
        const rel = await isRelevantSource(r, topicTitle);
        if (!rel.relevant) {
          console.log(`[Tavily] Dropped baseline candidate "${r.title}": ${rel.reason}`);
          continue;
        }

        let article = await extractArticleContent(r.url, r.title);
        if (
          !article.content ||
          article.content.startsWith("Source article could not") ||
          article.content.length < 200
        ) {
          if (r.content && r.content.length > 150) {
            article = {
              url: r.url,
              title: r.title,
              publisher: domain,
              content: r.content,
            };
          } else {
            continue;
          }
        }

        // Enforce secondary source char limit from PIPELINE_CONFIG
        if (article.content.length > PIPELINE_CONFIG.limits.secondarySourceCharLimit) {
          article.content = article.content.slice(
            0,
            PIPELINE_CONFIG.limits.secondarySourceCharLimit,
          );
        }

        article.role = "community_discussion";
        seenDomains.add(domain);
        seenUrls.add(r.url);
        communitySources.push(article);
      }
    } catch (err) {
      console.warn(
        `⚠️ [Tavily] Multi-source gathering warning: ${(err as Error).message}`,
      );
    }
  }

  // Supplement with academic (arXiv) and developer community (Hacker News) sources
  // ONLY if the topic is research/paper-oriented and baseline/community sources have capacity (< 2 each)
  if (
    isResearchOrientedTopic(topicTitle) &&
    (baselineSources.length < 2 || communitySources.length < 2)
  ) {
    try {
      const supplementary = await discoverSecondarySources(topicTitle, primaryUrl);
      for (const s of supplementary) {
        const sDomain = getHostname(s.url);
        if (s.url && (seenUrls.has(s.url) || (sDomain && seenDomains.has(sDomain)))) {
          continue;
        }

        if (s.role === "academic_baseline" && baselineSources.length < 2) {
          baselineSources.push(s);
          if (sDomain) seenDomains.add(sDomain);
          seenUrls.add(s.url);
        } else if (s.role === "community_discussion" && communitySources.length < 2) {
          communitySources.push(s);
          if (sDomain) seenDomains.add(sDomain);
          seenUrls.add(s.url);
        }
      }
    } catch (err) {
      console.warn(
        `⚠️ [MultiSource] Supplementary arXiv/HN discovery warning: ${(err as Error).message}`,
      );
    }
  }

  const allSources = [...baselineSources, ...communitySources];
  // Strict rule: Only set research_depth = 'multi' if at least one relevant secondary source has 1,500+ characters
  const hasSubstantialSecondary = allSources.some((s) => s.content.length >= 1500);
  const researchDepth: "single" | "multi" = hasSubstantialSecondary ? "multi" : "single";

  if (researchDepth === "single") {
    console.warn(
      `⚠️ [MultiSource] Secondary sources lack substantial depth (<1,500 chars) or none found for "${topicTitle}". Marking research_depth: 'single'.`,
    );
  } else {
    console.log(
      `✓ [MultiSource] Assembled ${allSources.length} triangulating secondary sources (${baselineSources.length} baseline, ${communitySources.length} community). Substantial content verified.`,
    );
  }

  return {
    baselineSources,
    communitySources,
    allSources,
    researchDepth,
  };
}
