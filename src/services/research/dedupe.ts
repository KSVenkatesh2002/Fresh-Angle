import { slugify, generateTopicKey } from "@/lib/utils/slug";
import { PIPELINE_CONFIG } from "@/config/pipeline";
import { LIMITS } from "@/config/limits";

/**
 * Known tech entities mapped to canonical entity clusters for cooldown tracking.
 */
export const ENTITY_CLUSTERS: Record<string, string[]> = {
  NVIDIA: ["nvidia", "jensen huang", "jensen", "blackwell", "hopper", "cuda", "geforce", "dgx", "b200", "h100"],
  OpenAI: ["openai", "sam altman", "chatgpt", "gpt-4", "gpt-5", "o1", "o3", "sora", "greg brockman"],
  Anthropic: ["anthropic", "dario amodei", "claude", "sonnet", "opus", "haiku", "constitutional ai"],
  Google: ["google", "deepmind", "demis hassabis", "gemini", "gemma", "tpu", "transformer", "sundar pichai"],
  Meta: ["meta", "mark zuckerberg", "yann lecun", "llama", "fair", "pytorth"],
  Microsoft: ["microsoft", "satya nadella", "copilot", "azure", "phi-3", "phi-4"],
  Apple: ["apple", "apple intelligence", "tim cook", "metal", "apple silicon", "m4"],
  DeepSeek: ["deepseek", "deepseek-v3", "deepseek-r1", "fire-flyer"],
  TSMC: ["tsmc", "taiwan semiconductor", "c-c-wei", "morris chang"],
  Intel: ["intel", "pat gelsinger", "gaudi", "lunar lake", "arrow lake"],
  AMD: ["amd", "lisa su", "mi300", "mi325", "rocm", "ryzen"],
  Groq: ["groq", "lpu", "jonathan ross"],
  Cerebras: ["cerebras", "wafer scale", "andrew feldman"],
  xAI: ["xai", "grok", "elon musk", "colossus"],
  Amazon: ["amazon", "aws", "trainium", "inferentia", "bedrock", "andy jassy"],
};

/**
 * Extracts canonical entity identifiers from any title, excerpt, or text snippet.
 */
export function extractEntities(text: string): string[] {
  const lower = text.toLowerCase();
  const matchedEntities = new Set<string>();

  for (const [canonical, aliases] of Object.entries(ENTITY_CLUSTERS)) {
    for (const alias of aliases) {
      // Word boundary or clean substring check
      const regex = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (regex.test(lower)) {
        matchedEntities.add(canonical);
        break;
      }
    }
  }

  return Array.from(matchedEntities);
}

export interface PastPostMeta {
  title: string;
  createdAt: Date | string;
  excerpt?: string | null;
}

/**
 * Checks whether any of the candidate's entities are currently on cooldown
 * based on posts published in the last N days.
 */
export function checkEntityCooldown(
  entities: string[],
  pastPosts: PastPostMeta[],
  cooldownDays: number = LIMITS.entityCooldownDays,
  maxPostsPerPeriod: number = LIMITS.maxEntityPostsPerPeriod,
): { inCooldown: boolean; violatingEntity?: string; postCount: number } {
  if (entities.length === 0 || pastPosts.length === 0) {
    return { inCooldown: false, postCount: 0 };
  }

  const now = Date.now();
  const cutoffMs = cooldownDays * 24 * 60 * 60 * 1000;

  // Filter past posts to window
  const recentPosts = pastPosts.filter((p) => {
    const postTime = typeof p.createdAt === "string" ? new Date(p.createdAt).getTime() : p.createdAt.getTime();
    return now - postTime <= cutoffMs;
  });

  for (const entity of entities) {
    let count = 0;
    for (const pastPost of recentPosts) {
      const pastEntities = extractEntities(pastPost.title + " " + (pastPost.excerpt || ""));
      if (pastEntities.includes(entity)) {
        count++;
      }
    }

    if (count >= maxPostsPerPeriod) {
      return {
        inCooldown: true,
        violatingEntity: entity,
        postCount: count,
      };
    }
  }

  return { inCooldown: false, postCount: 0 };
}

/**
 * Computes k-gram word shingles from a text string.
 */
export function getWordShingles(text: string, k: number = 5): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const shingles = new Set<string>();
  if (words.length < k) {
    if (words.length > 0) {
      shingles.add(words.join(" "));
    }
    return shingles;
  }

  for (let i = 0; i <= words.length - k; i++) {
    shingles.add(words.slice(i, i + k).join(" "));
  }

  return shingles;
}

/**
 * Computes k-gram shingle Jaccard overlap between two texts (0.0 to 1.0).
 */
export function computeShingleSimilarity(
  textA: string,
  textB: string,
  k: number = 5,
): number {
  const shinglesA = getWordShingles(textA, k);
  const shinglesB = getWordShingles(textB, k);

  if (shinglesA.size === 0 && shinglesB.size === 0) return 1.0;
  if (shinglesA.size === 0 || shinglesB.size === 0) return 0.0;

  let intersection = 0;
  for (const s of shinglesA) {
    if (shinglesB.has(s)) {
      intersection++;
    }
  }

  const union = shinglesA.size + shinglesB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Checks if a candidate body or snippet overlaps significantly with past posts (> 20%).
 */
export function checkContentSimilarity(
  candidateText: string,
  pastContentList: string[],
  maxOverlap: number = LIMITS.sourceShingleJaccardMax,
): { isDuplicate: boolean; score: number; matchedSnippet?: string } {
  if (!candidateText || pastContentList.length === 0) {
    return { isDuplicate: false, score: 0 };
  }

  let highestScore = 0;
  let matchedSnippet: string | undefined;

  for (const past of pastContentList) {
    if (!past) continue;
    const score = computeShingleSimilarity(candidateText, past, 5);
    if (score > highestScore) {
      highestScore = score;
      matchedSnippet = past.slice(0, 100);
    }
    if (score >= maxOverlap) {
      return {
        isDuplicate: true,
        score,
        matchedSnippet,
      };
    }
  }

  return {
    isDuplicate: false,
    score: highestScore,
    matchedSnippet,
  };
}

/**
 * Computes Jaccard word similarity between two strings (0.0 to 1.0).
 */
export function computeJaccardSimilarity(textA: string, textB: string): number {
  const wordsA = new Set(
    slugify(textA)
      .split("-")
      .filter((w) => w.length > 2),
  );
  const wordsB = new Set(
    slugify(textB)
      .split("-")
      .filter((w) => w.length > 2),
  );

  if (wordsA.size === 0 && wordsB.size === 0) return 1.0;
  if (wordsA.size === 0 || wordsB.size === 0) return 0.0;

  let intersectionCount = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) {
      intersectionCount++;
    }
  }

  const unionCount = wordsA.size + wordsB.size - intersectionCount;
  return intersectionCount / unionCount;
}

/**
 * Computes Levenshtein edit distance ratio between two normalized strings (0.0 to 1.0).
 */
export function computeLevenshteinSimilarity(s1: string, s2: string): number {
  const a = slugify(s1);
  const b = slugify(s2);

  if (a === b) return 1.0;
  if (a.length === 0 || b.length === 0) return 0.0;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1, // deletion
        );
      }
    }
  }

  const distance = matrix[b.length][a.length];
  const maxLen = Math.max(a.length, b.length);
  return 1.0 - distance / maxLen;
}

/**
 * Checks if a candidate title is a duplicate of any existing topic or past post.
 */
export function isDuplicateTopic(
  candidateTitle: string,
  existingTitles: string[],
  existingTopicKeys: string[] = [],
  candidateUrl?: string,
  existingUrls: string[] = [],
): { isDuplicate: boolean; matchedWith?: string; score: number } {
  // 1. Exact Source URL match (same article already covered)
  if (candidateUrl && existingUrls.length > 0) {
    const cleanCandidateUrl = candidateUrl
      .split("?")[0]
      .replace(/\/+$/, "")
      .toLowerCase();
    const urlMatch = existingUrls.find((u) => {
      const cleanExisting = u.split("?")[0].replace(/\/+$/, "").toLowerCase();
      return cleanExisting === cleanCandidateUrl;
    });

    if (urlMatch) {
      return {
        isDuplicate: true,
        matchedWith: `Source URL: ${urlMatch}`,
        score: 1.0,
      };
    }
  }

  const candidateTopicKey = generateTopicKey(candidateTitle);

  // 2. Exact topic key match
  if (existingTopicKeys.includes(candidateTopicKey)) {
    return {
      isDuplicate: true,
      matchedWith: candidateTopicKey,
      score: 1.0,
    };
  }

  let highestScore = 0;
  let highestMatch: string | undefined;

  for (const pastTitle of existingTitles) {
    const jaccard = computeJaccardSimilarity(candidateTitle, pastTitle);
    const levenshtein = computeLevenshteinSimilarity(candidateTitle, pastTitle);
    const score = Math.max(jaccard, levenshtein);

    if (score > highestScore) {
      highestScore = score;
      highestMatch = pastTitle;
    }

    if (score >= PIPELINE_CONFIG.similarityThreshold) {
      return {
        isDuplicate: true,
        matchedWith: pastTitle,
        score,
      };
    }
  }

  return {
    isDuplicate: false,
    matchedWith: highestMatch,
    score: highestScore,
  };
}

/**
 * Checks a candidate title against existing database posts.
 */
export async function checkDuplicateCandidate(
  title: string,
): Promise<{ isDuplicate: boolean; matchedWith?: string; score: number }> {
  try {
    const { getDb } = await import("@/db/client");
    const { posts } = await import("@/db/schema");
    const past = await getDb()
      .select({ title: posts.title, topicKey: posts.topicKey })
      .from(posts);
    return isDuplicateTopic(
      title,
      past.map((p) => p.title),
      past.map((p) => p.topicKey),
    );
  } catch {
    return { isDuplicate: false, score: 0 };
  }
}
