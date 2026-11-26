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

export interface OriginalityConfig {
  readonly max3GramOverlap: number; // default: 0.05 (5%)
  readonly max4GramOverlap: number; // default: 0.02 (2%)
  readonly max5GramOverlap: number; // default: 0.01 (1%)
  readonly maxConsecutiveWordsRun: number; // default: 8 words
  readonly maxFlaggedSentences: number; // default: 3
  readonly sentenceJaccardThreshold: number; // default: 0.50
  readonly minSentenceWordCount: number; // default: 8 words
  readonly maxQuotesPerArticle: number; // default: 2
  readonly maxQuoteWords: number; // default: 14 (< 15 words)
  readonly maxLinksPerUrl: number; // default: 2
  readonly maxRewriteAttempts: number; // default: 2
  readonly enableWebCheckGate: boolean; // default: false
  readonly requireMultiSource: boolean; // default: false
}

function parseEnvFloat(key: string, defaultVal: number): number {
  const val = process.env[key];
  if (val !== undefined && val !== "") {
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) return parsed;
  }
  return defaultVal;
}

function parseEnvInt(key: string, defaultVal: number): number {
  const val = process.env[key];
  if (val !== undefined && val !== "") {
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed)) return parsed;
  }
  return defaultVal;
}

function parseEnvBool(key: string, defaultVal: boolean): boolean {
  const val = process.env[key]?.toLowerCase();
  if (val === "true" || val === "1") return true;
  if (val === "false" || val === "0") return false;
  return defaultVal;
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
    minTavilyRelevanceScore: parseEnvFloat("TAVILY_MIN_RELEVANCE_SCORE", 0.55),
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
  originality: {
    max3GramOverlap: parseEnvFloat("ORIGINALITY_MAX_3GRAM_OVERLAP", parseEnvFloat("ORIGINALITY_MAX_3GRAM", 0.05)),
    max4GramOverlap: parseEnvFloat("ORIGINALITY_MAX_4GRAM_OVERLAP", parseEnvFloat("ORIGINALITY_MAX_4GRAM", 0.02)),
    max5GramOverlap: parseEnvFloat("ORIGINALITY_MAX_5GRAM_OVERLAP", parseEnvFloat("ORIGINALITY_MAX_5GRAM", 0.01)),
    maxConsecutiveWordsRun: parseEnvInt("ORIGINALITY_MAX_RUN_WORDS", parseEnvInt("ORIGINALITY_MAX_RUN", 8)),
    maxFlaggedSentences: parseEnvInt("ORIGINALITY_MAX_FLAGGED_SENTENCES", parseEnvInt("ORIGINALITY_MAX_FLAGGED", 3)),
    sentenceJaccardThreshold: parseEnvFloat("ORIGINALITY_SENTENCE_JACCARD", 0.50),
    minSentenceWordCount: parseEnvInt("ORIGINALITY_MIN_SENTENCE_WORDS", 8),
    maxQuotesPerArticle: parseEnvInt("ORIGINALITY_MAX_QUOTES", 2),
    maxQuoteWords: parseEnvInt("ORIGINALITY_MAX_QUOTE_WORDS", 14), // under 15 words
    maxLinksPerUrl: parseEnvInt("ORIGINALITY_MAX_LINKS_PER_URL", 2),
    maxRewriteAttempts: parseEnvInt("ORIGINALITY_MAX_REWRITES", 2),
    enableWebCheckGate: parseEnvBool("ORIGINALITY_ENABLE_WEB_GATE", false),
    requireMultiSource: parseEnvBool("ORIGINALITY_REQUIRE_MULTI_SOURCE", false),
  } as OriginalityConfig,
  similarityThreshold: 0.45, // Jaccard / Levenshtein duplicate topic rejection threshold
  defaultCategory: "Artificial Intelligence",
} as const;
