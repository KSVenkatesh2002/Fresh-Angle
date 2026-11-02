import { slugify, generateTopicKey } from "@/lib/utils/slug";
import { PIPELINE_CONFIG } from "@/config/pipeline";

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
