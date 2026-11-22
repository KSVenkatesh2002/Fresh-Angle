import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import fs from "fs";
import path from "path";
import { getDb } from "../src/db/client";
import { posts, postSources } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { extractArticleContent } from "../src/services/research/sources";

export interface ArticleBaselineRow {
  slug: string;
  title: string;
  sourceUrl: string;
  wordCount: number;
  sourceCharCount: number;
  overlap3Gram: number; // 0.0 to 1.0
  overlap4Gram: number; // 0.0 to 1.0
  overlap5Gram: number; // 0.0 to 1.0
  maxConsecutiveWords: number;
  sourceNumbersCount: number;
  draftNumbersCount: number;
  sourceNumberReusePct: number; // % of source numbers present in draft
  draftNumberOriginPct: number; // % of draft numbers that came from source
  headingMatchPct: number; // % of draft headings matched to source headings
  headingOrderPct: number; // % monotonic alignment of matched headings (100% = identical sequence)
  fetchStatus: string;
}

/**
 * Excludes code blocks, inline code, blockquotes, tables, markdown headings, and URLs from draft text.
 */
export function cleanDraftTextForBaseline(contentMd: string): string {
  if (!contentMd) return "";

  return contentMd
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]+`/g, " ")
    .replace(/^[ \t]*>.*$/gm, " ")
    .replace(/^[ \t]*\|.*\|[ \t]*$/gm, " ")
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/https?:\/\/[^\s\)]+/g, " ")
    .replace(/^[ \t]*#{1,6}\s+.*$/gm, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts markdown headings from draft text in order.
 */
export function extractDraftHeadings(contentMd: string): string[] {
  const matches = contentMd.match(/^[ \t]*#{1,3}\s+(.+)$/gm);
  if (!matches) return [];
  return matches
    .map((m) => m.replace(/^[ \t]*#{1,3}\s+/, "").trim())
    .filter((h) => h.length > 4);
}

/**
 * Extracts numeric, percentage, metric, and quantitative values from text.
 */
export function extractNumbers(text: string): Set<string> {
  const matches = text.match(/\b\d+(?:\.\d+)?(?:%|x|b|m|k|gb|mb|tb|ms|s|ghz)?\b/gi);
  if (!matches) return new Set();
  const normalized = matches
    .map((m) => m.toLowerCase().trim())
    .filter((m) => m.length > 0 && !/^0+$/.test(m));
  return new Set(normalized);
}

/**
 * Normalizes text into cleaned lowercase word tokens for shingling and comparison.
 */
export function getWordTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

/**
 * Computes k-gram word shingles.
 */
export function getNGramShingles(words: string[], k: number): Set<string> {
  const shingles = new Set<string>();
  if (words.length < k) {
    if (words.length > 0) shingles.add(words.join(" "));
    return shingles;
  }
  for (let i = 0; i <= words.length - k; i++) {
    shingles.add(words.slice(i, i + k).join(" "));
  }
  return shingles;
}

/**
 * Computes shingle overlap ratio.
 */
export function computeOverlap(postShingles: Set<string>, sourceShingles: Set<string>): number {
  if (postShingles.size === 0) return 0;
  let matches = 0;
  for (const s of postShingles) {
    if (sourceShingles.has(s)) matches++;
  }
  return matches / postShingles.size;
}

/**
 * Finds the maximum run of consecutive matching words between post and source.
 */
export function findMaxConsecutiveMatchingWords(
  postWords: string[],
  sourceWords: string[],
): number {
  if (postWords.length === 0 || sourceWords.length === 0) return 0;

  const sourceWordPositions = new Map<string, number[]>();
  for (let j = 0; j < sourceWords.length; j++) {
    const w = sourceWords[j];
    const list = sourceWordPositions.get(w);
    if (list) {
      list.push(j);
    } else {
      sourceWordPositions.set(w, [j]);
    }
  }

  let maxLen = 0;
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
        maxLen = len;
      }
    }
  }

  return maxLen;
}

/**
 * Computes heading similarity and sequence preservation (order similarity).
 */
export function computeHeadingStructuralSimilarity(
  draftHeadings: string[],
  sourceHeadings: string[],
): { headingMatchPct: number; headingOrderPct: number } {
  if (draftHeadings.length === 0 || sourceHeadings.length === 0) {
    return { headingMatchPct: 0, headingOrderPct: 0 };
  }

  const matchedSourceIndices: number[] = [];

  for (const dH of draftHeadings) {
    const dWords = new Set(getWordTokens(dH));
    if (dWords.size === 0) continue;

    let bestMatchIdx = -1;
    let bestSim = 0;

    for (let sIdx = 0; sIdx < sourceHeadings.length; sIdx++) {
      const sWords = new Set(getWordTokens(sourceHeadings[sIdx]));
      if (sWords.size === 0) continue;

      let overlap = 0;
      for (const w of dWords) {
        if (sWords.has(w)) overlap++;
      }
      const sim = overlap / (dWords.size + sWords.size - overlap);
      if (sim > 0.30 && sim > bestSim) {
        bestSim = sim;
        bestMatchIdx = sIdx;
      }
    }

    if (bestMatchIdx !== -1) {
      matchedSourceIndices.push(bestMatchIdx);
    }
  }

  if (matchedSourceIndices.length === 0) {
    return { headingMatchPct: 0, headingOrderPct: 0 };
  }

  const headingMatchPct = (matchedSourceIndices.length / draftHeadings.length) * 100;

  // Compute Longest Increasing Subsequence (LIS) on matchedSourceIndices to measure sequence ordering
  const lis: number[] = [];
  for (const x of matchedSourceIndices) {
    let low = 0;
    let high = lis.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (lis[mid] < x) low = mid + 1;
      else high = mid;
    }
    lis[low] = x;
  }

  const headingOrderPct = (lis.length / matchedSourceIndices.length) * 100;

  return {
    headingMatchPct: Math.round(headingMatchPct * 10) / 10,
    headingOrderPct: Math.round(headingOrderPct * 10) / 10,
  };
}

function quantile(arr: number[], q: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

async function main() {
  console.log("🔬 Starting Phase 0.5: Full-Text & Structural Originality Baseline...\n");
  const db = getDb();

  const publishedPosts = await db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      contentMd: posts.contentMd,
    })
    .from(posts)
    .where(eq(posts.status, "published"));

  console.log(`Analyzing ${publishedPosts.length} published articles against 100% FULL source text...`);

  const allSources = await db.select().from(postSources);
  const sourcesByPostId = new Map<string, typeof allSources>();
  for (const s of allSources) {
    const list = sourcesByPostId.get(s.postId) || [];
    list.push(s);
    sourcesByPostId.set(s.postId, list);
  }

  const results: ArticleBaselineRow[] = [];
  const fullCacheDir = path.join(process.cwd(), ".cache", "source-full-extracts");
  if (!fs.existsSync(fullCacheDir)) {
    fs.mkdirSync(fullCacheDir, { recursive: true });
  }

  const failedSourcesList: Array<{ slug: string; url: string; error: string }> = [];

  for (let idx = 0; idx < publishedPosts.length; idx++) {
    const post = publishedPosts[idx];
    const postSourcesList = sourcesByPostId.get(post.id) || [];
    const primarySourceUrl = postSourcesList[0]?.url || "";

    const cleanDraft = cleanDraftTextForBaseline(post.contentMd);
    const postWords = getWordTokens(cleanDraft);
    const draftNumbers = extractNumbers(post.contentMd);
    const draftHeadings = extractDraftHeadings(post.contentMd);

    let combinedSourceText = "";
    const sourceHeadings: string[] = [];
    let fetchStatus = "ok";

    if (postSourcesList.length === 0) {
      fetchStatus = "no_source_recorded";
    } else {
      for (const s of postSourcesList) {
        try {
          const cacheKey = Buffer.from(s.url).toString("base64url").slice(0, 50);
          const cachePath = path.join(fullCacheDir, `${cacheKey}.json`);

          let sourceContent = "";
          let cachedHeadings: string[] = [];

          if (fs.existsSync(cachePath)) {
            const parsed = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
            sourceContent = parsed.content;
            cachedHeadings = parsed.headings || [];
          } else {
            // Fetch 100% full text without 5,000 char truncation (maxChars: 0)
            const extracted = await extractArticleContent(s.url, s.title, {
              maxChars: 0,
              extractHeadings: true,
            });
            sourceContent = extracted.content;
            cachedHeadings = extracted.headings || [];

            if (sourceContent && !sourceContent.startsWith("Source article could not")) {
              fs.writeFileSync(
                cachePath,
                JSON.stringify({ content: sourceContent, headings: cachedHeadings }),
                "utf-8",
              );
            }
          }

          if (sourceContent && !sourceContent.startsWith("Source article could not")) {
            combinedSourceText += "\n\n" + sourceContent;
            sourceHeadings.push(...cachedHeadings);
          } else {
            fetchStatus = "scrape_incomplete";
            failedSourcesList.push({ slug: post.slug, url: s.url, error: sourceContent.slice(0, 60) });
          }
        } catch (fetchErr) {
          fetchStatus = `fetch_error: ${(fetchErr as Error).message.slice(0, 30)}`;
          failedSourcesList.push({ slug: post.slug, url: s.url, error: (fetchErr as Error).message });
        }
      }
    }

    const sourceWords = getWordTokens(combinedSourceText);
    const sourceNumbers = extractNumbers(combinedSourceText);

    // Number reuse metrics
    let sourceNumbersReused = 0;
    for (const num of sourceNumbers) {
      if (draftNumbers.has(num)) sourceNumbersReused++;
    }
    const sourceNumberReusePct =
      sourceNumbers.size > 0 ? (sourceNumbersReused / sourceNumbers.size) * 100 : 0;

    let draftNumbersFromSource = 0;
    for (const num of draftNumbers) {
      if (sourceNumbers.has(num)) draftNumbersFromSource++;
    }
    const draftNumberOriginPct =
      draftNumbers.size > 0 ? (draftNumbersFromSource / draftNumbers.size) * 100 : 0;

    // Heading sequence similarity
    const { headingMatchPct, headingOrderPct } = computeHeadingStructuralSimilarity(
      draftHeadings,
      sourceHeadings,
    );

    // Shingle metrics on FULL source text
    const post3 = getNGramShingles(postWords, 3);
    const post4 = getNGramShingles(postWords, 4);
    const post5 = getNGramShingles(postWords, 5);

    const src3 = getNGramShingles(sourceWords, 3);
    const src4 = getNGramShingles(sourceWords, 4);
    const src5 = getNGramShingles(sourceWords, 5);

    const overlap3Gram = computeOverlap(post3, src3);
    const overlap4Gram = computeOverlap(post4, src4);
    const overlap5Gram = computeOverlap(post5, src5);
    const maxConsecutiveWords = findMaxConsecutiveMatchingWords(postWords, sourceWords);

    results.push({
      slug: post.slug,
      title: post.title,
      sourceUrl: primarySourceUrl,
      wordCount: postWords.length,
      sourceCharCount: combinedSourceText.length,
      overlap3Gram: Math.round(overlap3Gram * 1000) / 1000,
      overlap4Gram: Math.round(overlap4Gram * 1000) / 1000,
      overlap5Gram: Math.round(overlap5Gram * 1000) / 1000,
      maxConsecutiveWords,
      sourceNumbersCount: sourceNumbers.size,
      draftNumbersCount: draftNumbers.size,
      sourceNumberReusePct: Math.round(sourceNumberReusePct * 10) / 10,
      draftNumberOriginPct: Math.round(draftNumberOriginPct * 10) / 10,
      headingMatchPct,
      headingOrderPct,
      fetchStatus,
    });

    if ((idx + 1) % 15 === 0 || idx === publishedPosts.length - 1) {
      console.log(`Processed ${idx + 1}/${publishedPosts.length} articles...`);
    }
  }

  // 3. Write Updated CSV
  const csvHeader =
    "slug,title,source_url,word_count,source_chars,overlap_3gram,overlap_4gram,overlap_5gram,max_consecutive_words,source_numbers_reused_pct,draft_numbers_from_source_pct,heading_match_pct,heading_order_pct,fetch_status\n";

  const csvRows = results
    .map((r) =>
      [
        `"${r.slug}"`,
        `"${r.title.replace(/"/g, '""')}"`,
        `"${r.sourceUrl}"`,
        r.wordCount,
        r.sourceCharCount,
        (r.overlap3Gram * 100).toFixed(1) + "%",
        (r.overlap4Gram * 100).toFixed(1) + "%",
        (r.overlap5Gram * 100).toFixed(1) + "%",
        r.maxConsecutiveWords,
        r.sourceNumberReusePct.toFixed(1) + "%",
        r.draftNumberOriginPct.toFixed(1) + "%",
        r.headingMatchPct.toFixed(1) + "%",
        r.headingOrderPct.toFixed(1) + "%",
        `"${r.fetchStatus}"`,
      ].join(","),
    )
    .join("\n");

  const csvPath = path.join(process.cwd(), "scripts", "originality-baseline.csv");
  fs.writeFileSync(csvPath, csvHeader + csvRows, "utf-8");
  console.log(`\n💾 Updated full-text & structural CSV saved to: ${csvPath}\n`);

  // 4. Summary Statistics
  const valid = results.filter((r) => r.fetchStatus === "ok" && r.wordCount > 50);
  const data3 = valid.map((r) => r.overlap3Gram);
  const data4 = valid.map((r) => r.overlap4Gram);
  const data5 = valid.map((r) => r.overlap5Gram);
  const dataRuns = valid.map((r) => r.maxConsecutiveWords);
  const dataNumReuse = valid.map((r) => r.sourceNumberReusePct);
  const dataNumOrigin = valid.map((r) => r.draftNumberOriginPct);
  const dataHeadMatch = valid.map((r) => r.headingMatchPct);
  const dataHeadOrder = valid.map((r) => r.headingOrderPct);

  const mean = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

  console.log("================================================================================");
  console.log("📊 PHASE 0.5: FULL-TEXT & STRUCTURAL SIMILARITY BASELINE RESULTS");
  console.log("================================================================================");
  console.log(`Total Published Articles: ${results.length}`);
  console.log(`Articles with Valid Full-Text Source: ${valid.length}`);
  console.log("--------------------------------------------------------------------------------");
  console.log("METRIC                          | MEAN       | MEDIAN     | p90        | MAX");
  console.log("--------------------------------------------------------------------------------");
  console.log(
    `3-Gram Overlap (Full Source)    | ${(mean(data3) * 100).toFixed(1)}%     | ${(quantile(data3, 0.5) * 100).toFixed(1)}%     | ${(quantile(data3, 0.9) * 100).toFixed(1)}%      | ${(Math.max(...data3, 0) * 100).toFixed(1)}%`,
  );
  console.log(
    `4-Gram Overlap (Full Source)    | ${(mean(data4) * 100).toFixed(1)}%     | ${(quantile(data4, 0.5) * 100).toFixed(1)}%     | ${(quantile(data4, 0.9) * 100).toFixed(1)}%      | ${(Math.max(...data4, 0) * 100).toFixed(1)}%`,
  );
  console.log(
    `5-Gram Overlap (Full Source)    | ${(mean(data5) * 100).toFixed(1)}%     | ${(quantile(data5, 0.5) * 100).toFixed(1)}%     | ${(quantile(data5, 0.9) * 100).toFixed(1)}%      | ${(Math.max(...data5, 0) * 100).toFixed(1)}%`,
  );
  console.log(
    `Max Consecutive Words Run       | ${mean(dataRuns).toFixed(1)} words  | ${quantile(dataRuns, 0.5).toFixed(0)} words   | ${quantile(dataRuns, 0.9).toFixed(0)} words    | ${Math.max(...dataRuns, 0)} words`,
  );
  console.log(
    `Source Numbers Reused in Draft  | ${mean(dataNumReuse).toFixed(1)}%     | ${quantile(dataNumReuse, 0.5).toFixed(1)}%     | ${quantile(dataNumReuse, 0.9).toFixed(1)}%      | ${Math.max(...dataNumReuse, 0).toFixed(1)}%`,
  );
  console.log(
    `Draft Numbers From Source       | ${mean(dataNumOrigin).toFixed(1)}%     | ${quantile(dataNumOrigin, 0.5).toFixed(1)}%     | ${quantile(dataNumOrigin, 0.9).toFixed(1)}%      | ${Math.max(...dataNumOrigin, 0).toFixed(1)}%`,
  );
  console.log(
    `Draft Headings Matched to Source| ${mean(dataHeadMatch).toFixed(1)}%     | ${quantile(dataHeadMatch, 0.5).toFixed(1)}%     | ${quantile(dataHeadMatch, 0.9).toFixed(1)}%      | ${Math.max(...dataHeadMatch, 0).toFixed(1)}%`,
  );
  console.log(
    `Heading Sequence Order (LIS)    | ${mean(dataHeadOrder).toFixed(1)}%     | ${quantile(dataHeadOrder, 0.5).toFixed(1)}%    | ${quantile(dataHeadOrder, 0.9).toFixed(1)}%     | ${Math.max(...dataHeadOrder, 0).toFixed(1)}%`,
  );
  console.log("--------------------------------------------------------------------------------\n");

  // Top 10 worst offenders by composite structural & verbatim score
  const worst10 = [...valid]
    .sort((a, b) => {
      const scoreA = a.overlap5Gram * 30 + a.maxConsecutiveWords * 2 + a.draftNumberOriginPct * 0.3 + a.headingOrderPct * 0.2;
      const scoreB = b.overlap5Gram * 30 + b.maxConsecutiveWords * 2 + b.draftNumberOriginPct * 0.3 + b.headingOrderPct * 0.2;
      return scoreB - scoreA;
    })
    .slice(0, 10);

  console.log("⚠️ TOP 10 OVERALL WORST OFFENDERS (Ranked by Composite Verbatim & Structural Copying):");
  worst10.forEach((r, i) => {
    console.log(
      `${(i + 1).toString().padStart(2, " ")}. [5-gram: ${(r.overlap5Gram * 100).toFixed(1)}% | Run: ${r.maxConsecutiveWords} words | Numbers From Src: ${r.draftNumberOriginPct.toFixed(0)}% | Heading Order: ${r.headingOrderPct.toFixed(0)}%] ${r.slug}`,
    );
  });
  console.log("================================================================================\n");

  // 13 Unfetchable Sources
  const uniqueFailedUrls = new Map<string, { slug: string; error: string }>();
  for (const f of failedSourcesList) {
    if (!uniqueFailedUrls.has(f.url)) {
      uniqueFailedUrls.set(f.url, { slug: f.slug, error: f.error });
    }
  }

  console.log(`📋 UNFETCHABLE SOURCES AUDIT (${uniqueFailedUrls.size} URLs Encountered Issues):`);
  let count = 1;
  for (const [url, info] of uniqueFailedUrls.entries()) {
    console.log(`${(count++).toString().padStart(2, " ")}. [${info.error.slice(0, 45)}] ${url}`);
  }
  console.log("================================================================================\n");

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Fatal error in Phase 0.5 baseline:", err);
  process.exit(1);
});
