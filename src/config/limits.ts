export const LIMITS = {
  // Pagination
  postsPerPage: 12,
  searchSuggestionsLimit: 6,
  relatedPostsLimit: 3,
  recentPostsLimit: 6,
  adminPageSize: 20,

  // Content Quality Gates
  minWordCount: 700,
  targetWordCount: {
    short: 800,
    medium: 1200,
    long: 1800,
  },
  minH2Headings: 3,
  maxH2Headings: 6,
  minTags: 3,
  maxTags: 6,
  titleMinChars: 15,
  titleMaxChars: 90,
  metaTitleMaxChars: 60,
  metaDescMinChars: 60,
  metaDescMaxChars: 155,
  excerptMaxChars: 250,

  // Similarity & Duplicate Gates
  similarityThreshold: 0.45,
  contentSimhashMax: 0.3,
  sourceShingleJaccardMax: 0.2,
  entityCooldownDays: 7,
  maxEntityPostsPerPeriod: 2,
  maxConsecutiveCategoryPosts: 2,

  // Images
  coverWidth: 1200,
  coverHeight: 630,
  maxCoverSizeBytes: 125 * 1024, // 125KB

  // Network & AI Timeouts
  httpTimeoutMs: 15000,
  aiTimeoutMs: 60000,
  maxRetries: 2,
  tickIntervalMinutes: 30,
  lateSlotGraceMinutes: 60,
  autoPauseConsecutiveFailures: 3,
} as const;
