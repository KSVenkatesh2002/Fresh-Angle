import { getWordShingles } from "./dedupe";

export interface SentenceMatch {
  postSentence: string;
  sourceSentence: string;
  similarity: number; // 0.0 to 1.0
}

export interface OriginalityCheckResult {
  passed: boolean;
  originalityScore: number; // 0 to 100%
  overlapScore: number; // 0.0 to 1.0 (composite overlap)
  overlap3Gram: number; // 0.0 to 1.0
  overlap4Gram: number; // 0.0 to 1.0
  overlap5Gram: number; // 0.0 to 1.0
  maxSentenceOverlap: number; // 0.0 to 1.0
  matchedExcerpts: string[];
  flaggedSentences: SentenceMatch[];
  reasons: string[];
}

export interface OriginalityThresholds {
  max3GramOverlap?: number; // default: 0.12 (12%)
  max5GramOverlap?: number; // default: 0.05 (5%)
  maxSentenceSimilarity?: number; // default: 0.50 (50%)
  minOriginalityScore?: number; // default: 85%
}

/**
 * Splits text into normalized sentences for sentence-level similarity analysis.
 */
function extractSentences(text: string): string[] {
  return text
    .split(/(?<=[.?!])\s+(?=[A-Z0-9])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25);
}

/**
 * Extracts a normalized word set from a sentence (ignoring case, punctuation, short words).
 */
function getSentenceWordSet(sentence: string): Set<string> {
  const words = sentence
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
  return new Set(words);
}

/**
 * Computes Jaccard word-overlap similarity between two sentences.
 */
function computeSentenceSimilarity(sentenceA: string, sentenceB: string): number {
  const wordsA = getSentenceWordSet(sentenceA);
  const wordsB = getSentenceWordSet(sentenceB);

  if (wordsA.size < 5 || wordsB.size < 5) {
    return 0;
  }

  let intersectionCount = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) {
      intersectionCount++;
    }
  }

  const unionCount = wordsA.size + wordsB.size - intersectionCount;
  return unionCount === 0 ? 0 : intersectionCount / unionCount;
}

/**
 * Multi-Granularity Originality & Plagiarism Defense Engine.
 *
 * Checks a generated draft post against research source text across three layers:
 * 1. 3-gram, 4-gram, and 5-gram shingle overlap (identifies short phrase reuse and structural copying)
 * 2. Sentence-level semantic/token similarity (flags individual sentences mirroring sources > 50%)
 * 3. Weighted composite originality score (target >= 90%)
 */
export function checkOriginality(
  contentMd: string,
  sourcesText: string,
  thresholds?: OriginalityThresholds | number, // supports legacy number threshold
): OriginalityCheckResult {
  // Backwards compatibility with legacy maxOverlapThreshold number
  const config: Required<OriginalityThresholds> = {
    max3GramOverlap: 0.12,
    max5GramOverlap: 0.05,
    maxSentenceSimilarity: 0.50,
    minOriginalityScore: 85,
  };

  if (typeof thresholds === "number") {
    config.max5GramOverlap = thresholds;
    config.max3GramOverlap = thresholds * 1.5;
  } else if (thresholds) {
    if (thresholds.max3GramOverlap !== undefined) config.max3GramOverlap = thresholds.max3GramOverlap;
    if (thresholds.max5GramOverlap !== undefined) config.max5GramOverlap = thresholds.max5GramOverlap;
    if (thresholds.maxSentenceSimilarity !== undefined) config.maxSentenceSimilarity = thresholds.maxSentenceSimilarity;
    if (thresholds.minOriginalityScore !== undefined) config.minOriginalityScore = thresholds.minOriginalityScore;
  }

  if (!contentMd || !sourcesText) {
    return {
      passed: true,
      originalityScore: 100,
      overlapScore: 0,
      overlap3Gram: 0,
      overlap4Gram: 0,
      overlap5Gram: 0,
      maxSentenceOverlap: 0,
      matchedExcerpts: [],
      flaggedSentences: [],
      reasons: [],
    };
  }

  // Strip Markdown formatting, code blocks, tables, and links
  const cleanPostText = contentMd
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]+`/g, " ")
    .replace(/#{1,6}\s+/g, " ")
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/[|*\-_>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const cleanSourceText = sourcesText
    .replace(/\[SOURCE \d+[^\]]*\]/gi, " ")
    .replace(/\[Source \d+[^\]]*\]/g, " ")
    .replace(/TITLE:\s*[^\n]+/gi, " ")
    .replace(/PUBLISHER:\s*[^\n]+/gi, " ")
    .replace(/URL:\s*\S+/gi, " ")
    .replace(/CONTENT:\s*/gi, " ")
    .replace(/[|*\-_>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // 1. Shingle Overlap Computations (3-gram, 4-gram, 5-gram)
  const postShingles3 = getWordShingles(cleanPostText, 3);
  const sourceShingles3 = getWordShingles(cleanSourceText, 3);

  const postShingles4 = getWordShingles(cleanPostText, 4);
  const sourceShingles4 = getWordShingles(cleanSourceText, 4);

  const postShingles5 = getWordShingles(cleanPostText, 5);
  const sourceShingles5 = getWordShingles(cleanSourceText, 5);

  if (postShingles3.size === 0) {
    return {
      passed: false,
      originalityScore: 0,
      overlapScore: 1.0,
      overlap3Gram: 1.0,
      overlap4Gram: 1.0,
      overlap5Gram: 1.0,
      maxSentenceOverlap: 1.0,
      matchedExcerpts: ["Draft content too short to evaluate shingles"],
      flaggedSentences: [],
      reasons: ["Draft content too short to evaluate originality"],
    };
  }

  // Count matches
  let matchCount3 = 0;
  for (const s of postShingles3) {
    if (sourceShingles3.has(s)) matchCount3++;
  }

  let matchCount4 = 0;
  for (const s of postShingles4) {
    if (sourceShingles4.has(s)) matchCount4++;
  }

  let matchCount5 = 0;
  const matchedExcerpts: string[] = [];
  for (const s of postShingles5) {
    if (sourceShingles5.has(s)) {
      matchCount5++;
      if (matchedExcerpts.length < 5) {
        matchedExcerpts.push(s);
      }
    }
  }

  const overlap3Gram = postShingles3.size > 0 ? matchCount3 / postShingles3.size : 0;
  const overlap4Gram = postShingles4.size > 0 ? matchCount4 / postShingles4.size : 0;
  const overlap5Gram = postShingles5.size > 0 ? matchCount5 / postShingles5.size : 0;

  // Composite overlap: weighted combination
  const compositeOverlap = (overlap3Gram * 0.4) + (overlap4Gram * 0.3) + (overlap5Gram * 0.3);
  const originalityScore = Math.max(0, Math.min(100, Math.round((1 - compositeOverlap) * 100)));

  // 2. Sentence-Level Plagiarism Analysis
  const postSentences = extractSentences(cleanPostText);
  const sourceSentences = extractSentences(cleanSourceText);

  const flaggedSentences: SentenceMatch[] = [];
  let maxSentenceOverlap = 0;

  for (const pSentence of postSentences) {
    for (const sSentence of sourceSentences) {
      const sim = computeSentenceSimilarity(pSentence, sSentence);
      if (sim > maxSentenceOverlap) {
        maxSentenceOverlap = sim;
      }
      if (sim >= config.maxSentenceSimilarity) {
        flaggedSentences.push({
          postSentence: pSentence,
          sourceSentence: sSentence,
          similarity: Math.round(sim * 100) / 100,
        });
        break; // Flag once per post sentence
      }
    }
  }

  // 3. Evaluate Pass/Fail Criteria
  const reasons: string[] = [];

  if (overlap3Gram > config.max3GramOverlap) {
    reasons.push(
      `3-gram phrase overlap (${(overlap3Gram * 100).toFixed(1)}%) exceeds limit (${(config.max3GramOverlap * 100).toFixed(1)}%)`,
    );
  }

  if (overlap5Gram > config.max5GramOverlap) {
    reasons.push(
      `5-gram exact clause overlap (${(overlap5Gram * 100).toFixed(1)}%) exceeds limit (${(config.max5GramOverlap * 100).toFixed(1)}%)`,
    );
  }

  if (flaggedSentences.length > 0) {
    reasons.push(
      `${flaggedSentences.length} sentence(s) mirror source sentences with > ${Math.round(config.maxSentenceSimilarity * 100)}% similarity`,
    );
  }

  if (originalityScore < config.minOriginalityScore) {
    reasons.push(
      `Composite originality score (${originalityScore}%) is below minimum standard (${config.minOriginalityScore}%)`,
    );
  }

  const passed = reasons.length === 0;

  return {
    passed,
    originalityScore,
    overlapScore: compositeOverlap,
    overlap3Gram,
    overlap4Gram,
    overlap5Gram,
    maxSentenceOverlap,
    matchedExcerpts,
    flaggedSentences,
    reasons,
  };
}
