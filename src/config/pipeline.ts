export interface PipelineLimits {
  readonly maxCandidatesToFetch: number;
  readonly maxArticlesToResearch: number;
  readonly articleTextCharLimit: number;
  readonly primarySourceCharLimit: number;
  readonly secondarySourceCharLimit: number;
  readonly maxTotalResearchPromptChars: number;
  readonly maxTavilyQueriesPerArticle: number;
  readonly minTavilyRelevanceScore: number;
  readonly maxOutlineHeadings: number;
  readonly maxTagsPerPost: number;
  readonly minTagsPerPost: number;
  readonly titleMaxChars: number;
  readonly metaTitleMaxChars: number;
  readonly metaDescMaxChars: number;
  readonly coverWidth: number;
  readonly coverHeight: number;
  readonly maxCoverSizeBytes: number;
  readonly httpTimeoutMs: number;
  readonly aiTimeoutMs: number;
  readonly maxRetries: number;
}

export const PIPELINE_CONFIG = {
  version: "1.0.0",
  promptsVersion: "2026.11.01",
  limits: {
    maxCandidatesToFetch: 20,
    maxArticlesToResearch: 4,
    articleTextCharLimit: 5000,
    primarySourceCharLimit: 5000,
    secondarySourceCharLimit: 3500,
    maxTotalResearchPromptChars: 18000,
    maxTavilyQueriesPerArticle: 3,
    minTavilyRelevanceScore: 0.65,
    maxOutlineHeadings: 6,
    maxTagsPerPost: 6,
    minTagsPerPost: 3,
    titleMaxChars: 90,
    metaTitleMaxChars: 60,
    metaDescMaxChars: 155,
    coverWidth: 1200,
    coverHeight: 630,
    maxCoverSizeBytes: 125 * 1024, // 125KB target
    httpTimeoutMs: 15000, // 15s timeout
    aiTimeoutMs: 90000, // 90s timeout for AI generation
    maxRetries: 3,
  } as PipelineLimits,
  similarityThreshold: 0.45, // Jaccard / Levenshtein duplicate topic rejection threshold
  defaultCategory: "Artificial Intelligence",
} as const;
