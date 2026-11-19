import { getWordShingles } from "./dedupe";

export interface OriginalityCheckResult {
  passed: boolean;
  originalityScore: number; // 0 to 100%
  overlapScore: number; // 0.0 to 1.0
  matchedExcerpts: string[];
}

/**
 * Checks a generated post draft against external primary research source text.
 * Uses 5-gram word shingles to identify verbatim copying or direct phrasing.
 * Requires > 85% original synthesis (max 15% overlap allowed).
 */
export function checkOriginality(
  contentMd: string,
  sourcesText: string,
  maxOverlapThreshold: number = 0.15,
): OriginalityCheckResult {
  if (!contentMd || !sourcesText) {
    return {
      passed: true,
      originalityScore: 100,
      overlapScore: 0,
      matchedExcerpts: [],
    };
  }

  // Strip Markdown syntax and code blocks before shingling
  const cleanPostText = contentMd
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]+`/g, " ")
    .replace(/#{1,6}\s+/g, " ")
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/[|*\-_>]/g, " ")
    .trim();

  const cleanSourceText = sourcesText
    .replace(/\[Source \d+\]/g, " ")
    .replace(/URL:\s*\S+/g, " ")
    .replace(/[|*\-_>]/g, " ")
    .trim();

  const postShingles = getWordShingles(cleanPostText, 5);
  const sourceShingles = getWordShingles(cleanSourceText, 5);

  if (postShingles.size === 0) {
    return {
      passed: false,
      originalityScore: 0,
      overlapScore: 1.0,
      matchedExcerpts: ["Draft content too short to evaluate shingles"],
    };
  }

  let matchingShinglesCount = 0;
  const matchedExcerpts: string[] = [];

  for (const shingle of postShingles) {
    if (sourceShingles.has(shingle)) {
      matchingShinglesCount++;
      if (matchedExcerpts.length < 5) {
        matchedExcerpts.push(shingle);
      }
    }
  }

  const overlapScore = matchingShinglesCount / postShingles.size;
  const originalityScore = Math.max(0, Math.round((1 - overlapScore) * 100));
  const passed = overlapScore <= maxOverlapThreshold;

  return {
    passed,
    originalityScore,
    overlapScore,
    matchedExcerpts,
  };
}
