import { getWordShingles } from "./dedupe";
import { PIPELINE_CONFIG } from "@/config/pipeline";

export interface SentenceMatch {
  postSentence: string;
  sourceSentence: string;
  similarity: number; // 0.0 to 1.0 Jaccard on content words
}

export interface DetectedQuote {
  text: string;
  wordCount: number;
  isUnderLimit: boolean;
  isAttributed: boolean;
}

export interface OriginalityCheckResult {
  passed: boolean;
  originalityScore: number; // 0 to 100%
  overlapScore: number; // 0.0 to 1.0 (composite overlap)
  overlap3Gram: number; // 0.0 to 1.0
  overlap4Gram: number; // 0.0 to 1.0
  overlap5Gram: number; // 0.0 to 1.0
  maxConsecutiveWordsRun: number;
  longestRunExcerpt: string;
  quoteCount: number;
  quotedWordCount: number;
  quotes: DetectedQuote[];
  flaggedSentences: SentenceMatch[];
  reasons: string[];
}

export interface CustomOriginalityThresholds {
  max3GramOverlap?: number;
  max4GramOverlap?: number;
  max5GramOverlap?: number;
  maxConsecutiveWordsRun?: number;
  maxFlaggedSentences?: number;
  sentenceJaccardThreshold?: number;
  minSentenceWordCount?: number;
  maxQuotesPerArticle?: number;
  maxQuoteWords?: number;
}

export const STOPWORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't",
  "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by",
  "can", "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does", "doesn't", "doing",
  "don't", "down", "during", "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't",
  "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here", "here's", "hers", "herself",
  "him", "himself", "his", "how", "how's", "i", "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is",
  "isn't", "it", "it's", "its", "itself", "let's", "me", "more", "most", "mustn't", "my", "myself", "no",
  "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves",
  "out", "over", "own", "same", "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't", "so",
  "some", "such", "than", "that", "that's", "the", "their", "theirs", "them", "themselves", "then", "there",
  "there's", "these", "they", "they'd", "they'll", "they're", "they've", "this", "those", "through", "to",
  "too", "under", "until", "up", "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were",
  "weren't", "what", "what's", "when", "when's", "where", "where's", "which", "while", "who", "who's",
  "whom", "why", "why's", "with", "won't", "would", "wouldn't", "you", "you'd", "you'll", "you're", "you've",
  "your", "yours", "yourself", "yourselves"
]);

/**
 * Strips code blocks, inline code, markdown tables, blockquotes, URLs, and headers
 * so originality metrics measure ONLY synthesized prose.
 */
export function cleanTextForOriginality(contentMd: string): string {
  if (!contentMd) return "";
  return contentMd
    .replace(/\[SOURCE \d+[^\]]*\]/gi, " ")
    .replace(/\[Source \d+[^\]]*\]/g, " ")
    .replace(/TITLE:\s*[^\n]+/gi, " ")
    .replace(/PUBLISHER:\s*[^\n]+/gi, " ")
    .replace(/URL:\s*\S+/gi, " ")
    .replace(/CONTENT:\s*/gi, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]+`/g, " ")
    .replace(/^[ \t]*\|.*\|[ \t]*$/gm, " ")
    .replace(/^[ \t]*>.*$/gm, " ")
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/https?:\/\/[^\s\)]+/g, " ")
    .replace(/^[ \t]*#{1,6}\s+.*$/gm, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getWordTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

/**
 * Extracts and inspects direct quotes in Markdown text.
 */
export function extractQuotes(
  contentMd: string,
  maxQuoteWords: number = 14,
): {
  quotes: DetectedQuote[];
  totalQuoteWords: number;
  quoteCount: number;
} {
  const quoteRegex = /"([^"\n]{5,300})"/g;
  const quotes: DetectedQuote[] = [];
  let totalQuoteWords = 0;

  for (const match of contentMd.matchAll(quoteRegex)) {
    const rawQuote = match[1].trim();
    const words = rawQuote.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    totalQuoteWords += wordCount;

    const matchIndex = match.index ?? 0;
    const surrounding = contentMd.slice(Math.max(0, matchIndex - 60), matchIndex + rawQuote.length + 60).toLowerCase();
    const isAttributed = /(according to|states|stated|wrote|notes|noted|explained|said|reports|reported|\[[^\]]+\]\(https?:\/\/)/i.test(surrounding);

    quotes.push({
      text: rawQuote,
      wordCount,
      isUnderLimit: wordCount <= maxQuoteWords,
      isAttributed,
    });
  }

  return {
    quotes,
    totalQuoteWords,
    quoteCount: quotes.length,
  };
}

/**
 * Finds the longest run of consecutive words shared between postWords and sourceWords.
 * Exempts known allowed quote word sequences from triggering a violation.
 */
export function findLongestConsecutiveWordRun(
  postWords: string[],
  sourceWords: string[],
  exemptSequences: Set<string> = new Set(),
): { maxRun: number; runExcerpt: string } {
  if (postWords.length === 0 || sourceWords.length === 0) return { maxRun: 0, runExcerpt: "" };
  const sourceWordPositions = new Map<string, number[]>();
  for (let j = 0; j < sourceWords.length; j++) {
    const w = sourceWords[j];
    const list = sourceWordPositions.get(w);
    if (list) list.push(j);
    else sourceWordPositions.set(w, [j]);
  }

  let maxLen = 0;
  let bestExcerpt = "";

  for (let i = 0; i < postWords.length; i++) {
    if (postWords.length - i <= maxLen) break;
    const w = postWords[i];
    const positions = sourceWordPositions.get(w);
    if (!positions) continue;

    for (const j of positions) {
      let len = 0;
      while (
        i + len < postWords.length &&
        j + len < sourceWords.length &&
        postWords[i + len] === sourceWords[j + len]
      ) {
        len++;
      }

      if (len > maxLen) {
        const seq = postWords.slice(i, i + len).join(" ");
        if (!exemptSequences.has(seq)) {
          maxLen = len;
          bestExcerpt = seq;
        }
      }
    }
  }

  return { maxRun: maxLen, runExcerpt: bestExcerpt };
}

/**
 * Splits text into normalized sentences for sentence-level similarity analysis.
 */
export function extractSentences(text: string): string[] {
  return text
    .split(/(?<=[.?!])\s+(?=[A-Z0-9])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
}

/**
 * Computes Jaccard word-overlap similarity between two sentences.
 * Ignores sentences under 8 words, strips stopwords, and checks content word overlap.
 */
export function computeSentenceSimilarity(sentenceA: string, sentenceB: string): number {
  const rawWordsA = sentenceA.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter((w) => w.length > 2);
  const rawWordsB = sentenceB.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter((w) => w.length > 2);

  // Ignore sentences under 8 words
  if (rawWordsA.length < 8 || rawWordsB.length < 8) {
    return 0;
  }

  // Remove stopwords
  const contentWordsA = new Set(rawWordsA.filter((w) => !STOPWORDS.has(w)));
  const contentWordsB = new Set(rawWordsB.filter((w) => !STOPWORDS.has(w)));

  if (contentWordsA.size < 4 || contentWordsB.size < 4) {
    return 0;
  }

  let intersectionCount = 0;
  for (const word of contentWordsA) {
    if (contentWordsB.has(word)) {
      intersectionCount++;
    }
  }

  const unionCount = contentWordsA.size + contentWordsB.size - intersectionCount;
  return unionCount === 0 ? 0 : intersectionCount / unionCount;
}

/**
 * Multi-Granularity Originality & Plagiarism Defense Gate (Phase 3).
 *
 * Compares draft post against ALL fetched research sources:
 * - 3-gram, 4-gram, 5-gram shingle overlap (excluding code, tables, URLs)
 * - Longest consecutive matching words run (exempting attributed quotes < 15 words)
 * - Quoted words and quote counts
 * - Sentence-level Jaccard similarity (ignoring <8 words and stopwords, flagging >0.5)
 */
export function checkOriginality(
  contentMd: string,
  sourcesText: string,
  thresholds?: CustomOriginalityThresholds | number,
): OriginalityCheckResult {
  const cfg = PIPELINE_CONFIG.originality;
  const config: Required<CustomOriginalityThresholds> = {
    max3GramOverlap: cfg.max3GramOverlap,
    max4GramOverlap: cfg.max4GramOverlap,
    max5GramOverlap: cfg.max5GramOverlap,
    maxConsecutiveWordsRun: cfg.maxConsecutiveWordsRun,
    maxFlaggedSentences: cfg.maxFlaggedSentences,
    sentenceJaccardThreshold: cfg.sentenceJaccardThreshold,
    minSentenceWordCount: cfg.minSentenceWordCount,
    maxQuotesPerArticle: cfg.maxQuotesPerArticle,
    maxQuoteWords: cfg.maxQuoteWords,
  };

  if (typeof thresholds === "number") {
    config.max5GramOverlap = thresholds;
    config.max3GramOverlap = thresholds * 2.0;
  } else if (thresholds) {
    Object.assign(config, thresholds);
  }

  if (!contentMd || !sourcesText) {
    return {
      passed: true,
      originalityScore: 100,
      overlapScore: 0,
      overlap3Gram: 0,
      overlap4Gram: 0,
      overlap5Gram: 0,
      maxConsecutiveWordsRun: 0,
      longestRunExcerpt: "",
      quoteCount: 0,
      quotedWordCount: 0,
      quotes: [],
      flaggedSentences: [],
      reasons: [],
    };
  }

  // 1. Extract and inspect quotes
  const { quotes, totalQuoteWords, quoteCount } = extractQuotes(contentMd, config.maxQuoteWords);
  const exemptQuoteSequences = new Set<string>();
  for (const q of quotes) {
    if (q.isUnderLimit && q.isAttributed) {
      exemptQuoteSequences.add(q.text.toLowerCase().replace(/[^\w\s]/g, " ").trim());
    }
  }

  // 2. Clean text for prose analysis
  const cleanPostText = cleanTextForOriginality(contentMd);
  const cleanSourceText = cleanTextForOriginality(sourcesText);

  // 3. Shingle Overlap Computations (3-gram, 4-gram, 5-gram)
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
      maxConsecutiveWordsRun: 0,
      longestRunExcerpt: "",
      quoteCount,
      quotedWordCount: totalQuoteWords,
      quotes,
      flaggedSentences: [],
      reasons: ["Draft content too short to evaluate originality"],
    };
  }

  let matchCount3 = 0;
  for (const s of postShingles3) if (sourceShingles3.has(s)) matchCount3++;

  let matchCount4 = 0;
  for (const s of postShingles4) if (sourceShingles4.has(s)) matchCount4++;

  let matchCount5 = 0;
  for (const s of postShingles5) if (sourceShingles5.has(s)) matchCount5++;

  const overlap3Gram = postShingles3.size > 0 ? matchCount3 / postShingles3.size : 0;
  const overlap4Gram = postShingles4.size > 0 ? matchCount4 / postShingles4.size : 0;
  const overlap5Gram = postShingles5.size > 0 ? matchCount5 / postShingles5.size : 0;

  // 4. Consecutive Word Run
  const postWords = getWordTokens(cleanPostText);
  const sourceWords = getWordTokens(cleanSourceText);
  const { maxRun, runExcerpt } = findLongestConsecutiveWordRun(postWords, sourceWords, exemptQuoteSequences);

  // Mathematical invariant check: if maxRun >= 3, overlap3Gram MUST be > 0
  const adjustedOverlap3Gram = maxRun >= 3 && overlap3Gram === 0 && postShingles3.size > 0
    ? 1 / postShingles3.size
    : overlap3Gram;

  // Composite score
  const compositeOverlap = (adjustedOverlap3Gram * 0.4) + (overlap4Gram * 0.3) + (overlap5Gram * 0.3);
  const originalityScore = Math.max(0, Math.min(100, Math.round((1 - compositeOverlap) * 100)));

  // 5. Sentence-Level Plagiarism Analysis (Stopwords stripped, len >= 8)
  const postSentences = extractSentences(cleanPostText);
  const sourceSentences = extractSentences(cleanSourceText);

  const flaggedSentences: SentenceMatch[] = [];
  for (const pSentence of postSentences) {
    for (const sSentence of sourceSentences) {
      const sim = computeSentenceSimilarity(pSentence, sSentence);
      if (sim >= config.sentenceJaccardThreshold) {
        flaggedSentences.push({
          postSentence: pSentence,
          sourceSentence: sSentence,
          similarity: Math.round(sim * 100) / 100,
        });
        break; // Flag once per post sentence
      }
    }
  }

  // 6. Evaluate Pass/Fail Criteria
  const reasons: string[] = [];

  if (adjustedOverlap3Gram > config.max3GramOverlap) {
    reasons.push(
      `3-gram phrase overlap (${(adjustedOverlap3Gram * 100).toFixed(1)}%) exceeds limit (${(config.max3GramOverlap * 100).toFixed(1)}%)`,
    );
  }

  if (overlap4Gram > config.max4GramOverlap) {
    reasons.push(
      `4-gram phrase overlap (${(overlap4Gram * 100).toFixed(1)}%) exceeds limit (${(config.max4GramOverlap * 100).toFixed(1)}%)`,
    );
  }

  if (overlap5Gram > config.max5GramOverlap) {
    reasons.push(
      `5-gram exact clause overlap (${(overlap5Gram * 100).toFixed(1)}%) exceeds limit (${(config.max5GramOverlap * 100).toFixed(1)}%)`,
    );
  }

  if (maxRun > config.maxConsecutiveWordsRun) {
    reasons.push(
      `Longest consecutive matching words (${maxRun} words: "${runExcerpt}") exceeds limit (${config.maxConsecutiveWordsRun} words)`,
    );
  }

  if (flaggedSentences.length > config.maxFlaggedSentences) {
    reasons.push(
      `${flaggedSentences.length} sentence(s) mirror source sentences with > ${Math.round(config.sentenceJaccardThreshold * 100)}% similarity (limit: ${config.maxFlaggedSentences})`,
    );
  }

  if (quoteCount > config.maxQuotesPerArticle) {
    reasons.push(
      `Post contains ${quoteCount} direct quotes (limit: ${config.maxQuotesPerArticle})`,
    );
  }

  for (const q of quotes) {
    if (!q.isUnderLimit) {
      reasons.push(`Direct quote exceeds length limit (${q.wordCount} words > ${config.maxQuoteWords} max): "${q.text.slice(0, 40)}..."`);
    }
  }

  const passed = reasons.length === 0;

  return {
    passed,
    originalityScore,
    overlapScore: compositeOverlap,
    overlap3Gram: adjustedOverlap3Gram,
    overlap4Gram,
    overlap5Gram,
    maxConsecutiveWordsRun: maxRun,
    longestRunExcerpt: runExcerpt,
    quoteCount,
    quotedWordCount: totalQuoteWords,
    quotes,
    flaggedSentences,
    reasons,
  };
}

/**
 * Optional web-check gate: queries Tavily on distinctive sentences from the draft,
 * fetches matched pages (skipping paywalls), and measures overlap.
 */
export async function checkOriginalityWebGate(
  contentMd: string,
  sampleSentences: string[],
): Promise<{ passed: boolean; checkedUrls: string[]; max3Gram: number; maxRun: number }> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey || sampleSentences.length === 0) {
    return { passed: true, checkedUrls: [], max3Gram: 0, maxRun: 0 };
  }

  const cleanPost = cleanTextForOriginality(contentMd);
  const postWords = getWordTokens(cleanPost);
  const postShingles3 = getWordShingles(cleanPost, 3);

  let highest3Gram = 0;
  let highestRun = 0;
  const checkedUrls: string[] = [];

  for (const sentence of sampleSentences.slice(0, 3)) {
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query: `"${sentence.slice(0, 60)}"`,
          search_depth: "basic",
          max_results: 3,
        }),
      });

      if (!res.ok) continue;
      const data = (await res.json()) as { results?: Array<{ url: string; content?: string }> };
      for (const item of data.results || []) {
        if (!item.content || item.content.length < 200) continue;
        checkedUrls.push(item.url);
        const sourceWords = getWordTokens(cleanTextForOriginality(item.content));
        const sourceShingles3 = getWordShingles(cleanTextForOriginality(item.content), 3);

        let matches = 0;
        for (const s of postShingles3) if (sourceShingles3.has(s)) matches++;
        const o3 = postShingles3.size > 0 ? matches / postShingles3.size : 0;
        const { maxRun } = findLongestConsecutiveWordRun(postWords, sourceWords);

        if (o3 > highest3Gram) highest3Gram = o3;
        if (maxRun > highestRun) highestRun = maxRun;
      }
    } catch {
      // Non-blocking
    }
  }

  const passed = highest3Gram <= PIPELINE_CONFIG.originality.max3GramOverlap &&
                 highestRun <= PIPELINE_CONFIG.originality.maxConsecutiveWordsRun;

  return {
    passed,
    checkedUrls,
    max3Gram: highest3Gram,
    maxRun: highestRun,
  };
}
