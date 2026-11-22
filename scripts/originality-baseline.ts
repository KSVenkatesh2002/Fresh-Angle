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
  overlap3Gram: number; // 0.0 to 1.0
  overlap4Gram: number; // 0.0 to 1.0
  overlap5Gram: number; // 0.0 to 1.0
  maxConsecutiveWords: number;
  fetchStatus: string;
}

/**
 * Excludes code blocks, inline code, blockquotes, tables, markdown headings, and URLs from draft text.
 */
export function cleanDraftTextForBaseline(contentMd: string): string {
  if (!contentMd) return "";

  return contentMd
    // 1. Remove fenced code blocks
    .replace(/```[\s\S]*?```/g, " ")
    // 2. Remove inline code
    .replace(/`[^`]+`/g, " ")
    // 3. Remove blockquotes (lines starting with >)
    .replace(/^[ \t]*>.*$/gm, " ")
    // 4. Remove tables (lines starting/ending with | or containing markdown table rows)
    .replace(/^[ \t]*\|.*\|[ \t]*$/gm, " ")
    // 5. Remove markdown links: [anchor text](url) -> keep only anchor text
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    // 6. Remove standalone URLs
    .replace(/https?:\/\/[^\s\)]+/g, " ")
    // 7. Remove markdown headings
    .replace(/^[ \t]*#{1,6}\s+.*$/gm, " ")
    // 8. Normalize whitespace
    .replace(/\s+/g, " ")
    .trim();
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
 * Computes shingle overlap ratio (matches / postShingles.size).
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
 * Finds the maximum length of consecutive matching word tokens between post and source.
 */
export function findMaxConsecutiveMatchingWords(
  postWords: string[],
  sourceWords: string[],
): number {
  if (postWords.length === 0 || sourceWords.length === 0) return 0;

  // Build word index for source text
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
 * Helper to compute statistical percentiles (e.g. p90, median).
 */
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
  console.log("📊 Starting Originality Baseline Analysis for Fresh Angle Articles...\n");
  const db = getDb();

  // 1. Fetch published posts
  const publishedPosts = await db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      contentMd: posts.contentMd,
    })
    .from(posts)
    .where(eq(posts.status, "published"));

  console.log(`Retrieved ${publishedPosts.length} published articles from database.`);
  if (publishedPosts.length === 0) {
    console.log("No published posts found.");
    process.exit(0);
  }

  // 2. Fetch all sources
  const allSources = await db.select().from(postSources);
  const sourcesByPostId = new Map<string, typeof allSources>();
  for (const s of allSources) {
    const list = sourcesByPostId.get(s.postId) || [];
    list.push(s);
    sourcesByPostId.set(s.postId, list);
  }

  const results: ArticleBaselineRow[] = [];
  const cacheDir = path.join(process.cwd(), ".cache", "source-extracts");
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  console.log(`Processing and re-fetching source documents for ${publishedPosts.length} articles...\n`);

  for (let idx = 0; idx < publishedPosts.length; idx++) {
    const post = publishedPosts[idx];
    const postSourcesList = sourcesByPostId.get(post.id) || [];
    const primarySourceUrl = postSourcesList[0]?.url || "";

    // Clean draft text (exclude code blocks, tables, blockquotes, URLs)
    const cleanDraft = cleanDraftTextForBaseline(post.contentMd);
    const postWords = getWordTokens(cleanDraft);

    let combinedSourceText = "";
    let fetchStatus = "ok";

    if (postSourcesList.length === 0) {
      fetchStatus = "no_source_recorded";
    } else {
      // Fetch each source URL (with disk cache to avoid re-hammering web servers)
      for (const s of postSourcesList) {
        try {
          const cacheKey = Buffer.from(s.url).toString("base64url").slice(0, 50);
          const cachePath = path.join(cacheDir, `${cacheKey}.txt`);

          let sourceContent = "";
          if (fs.existsSync(cachePath)) {
            sourceContent = fs.readFileSync(cachePath, "utf-8");
          } else {
            const extracted = await extractArticleContent(s.url, s.title);
            sourceContent = extracted.content;
            if (sourceContent && !sourceContent.startsWith("Source article could not")) {
              fs.writeFileSync(cachePath, sourceContent, "utf-8");
            }
          }

          if (sourceContent && !sourceContent.startsWith("Source article could not")) {
            combinedSourceText += "\n\n" + sourceContent;
          } else {
            fetchStatus = "scrape_incomplete";
          }
        } catch (fetchErr) {
          fetchStatus = `fetch_error: ${(fetchErr as Error).message.slice(0, 30)}`;
        }
      }
    }

    const sourceWords = getWordTokens(combinedSourceText);

    // Compute shingles
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
      overlap3Gram: Math.round(overlap3Gram * 1000) / 1000,
      overlap4Gram: Math.round(overlap4Gram * 1000) / 1000,
      overlap5Gram: Math.round(overlap5Gram * 1000) / 1000,
      maxConsecutiveWords,
      fetchStatus,
    });

    if ((idx + 1) % 10 === 0 || idx === publishedPosts.length - 1) {
      console.log(`Analyzed ${idx + 1}/${publishedPosts.length} articles...`);
    }
  }

  // 3. Write CSV Output
  const csvHeader = "slug,title,source_url,word_count,overlap_3gram,overlap_4gram,overlap_5gram,max_consecutive_words,fetch_status\n";
  const csvRows = results
    .map((r) =>
      [
        `"${r.slug}"`,
        `"${r.title.replace(/"/g, '""')}"`,
        `"${r.sourceUrl}"`,
        r.wordCount,
        (r.overlap3Gram * 100).toFixed(1) + "%",
        (r.overlap4Gram * 100).toFixed(1) + "%",
        (r.overlap5Gram * 100).toFixed(1) + "%",
        r.maxConsecutiveWords,
        `"${r.fetchStatus}"`,
      ].join(","),
    )
    .join("\n");

  const csvPath = path.join(process.cwd(), "scripts", "originality-baseline.csv");
  fs.writeFileSync(csvPath, csvHeader + csvRows, "utf-8");
  console.log(`\n💾 CSV saved to: ${csvPath}\n`);

  // 4. Calculate Summary Statistics across valid scrapes
  const validResults = results.filter((r) => r.fetchStatus === "ok" && r.wordCount > 50);
  const data3 = validResults.map((r) => r.overlap3Gram);
  const data4 = validResults.map((r) => r.overlap4Gram);
  const data5 = validResults.map((r) => r.overlap5Gram);
  const dataRuns = validResults.map((r) => r.maxConsecutiveWords);

  const mean = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

  console.log("================================================================================");
  console.log("📊 EMPIRICAL ORIGINALITY & PLAGIARISM BASELINE (Phase 0 Audit)");
  console.log("================================================================================");
  console.log(`Total Published Articles: ${results.length}`);
  console.log(`Articles with Successfully Re-Fetched Sources: ${validResults.length}`);
  console.log("--------------------------------------------------------------------------------");
  console.log(`METRIC                | MEAN       | MEDIAN (p50) | p90        | MAX`);
  console.log("--------------------------------------------------------------------------------");
  console.log(
    `3-Gram Overlap        | ${(mean(data3) * 100).toFixed(1)}%     | ${(quantile(data3, 0.5) * 100).toFixed(1)}%        | ${(quantile(data3, 0.9) * 100).toFixed(1)}%      | ${(Math.max(...data3, 0) * 100).toFixed(1)}%`,
  );
  console.log(
    `4-Gram Overlap        | ${(mean(data4) * 100).toFixed(1)}%     | ${(quantile(data4, 0.5) * 100).toFixed(1)}%        | ${(quantile(data4, 0.9) * 100).toFixed(1)}%      | ${(Math.max(...data4, 0) * 100).toFixed(1)}%`,
  );
  console.log(
    `5-Gram Overlap        | ${(mean(data5) * 100).toFixed(1)}%     | ${(quantile(data5, 0.5) * 100).toFixed(1)}%        | ${(quantile(data5, 0.9) * 100).toFixed(1)}%      | ${(Math.max(...data5, 0) * 100).toFixed(1)}%`,
  );
  console.log(
    `Max Consecutive Words | ${mean(dataRuns).toFixed(1)} words  | ${quantile(dataRuns, 0.5).toFixed(0)} words     | ${quantile(dataRuns, 0.9).toFixed(0)} words    | ${Math.max(...dataRuns, 0)} words`,
  );
  console.log("--------------------------------------------------------------------------------\n");

  // 5. Worst 10 Articles (Ranked by 5-Gram Overlap & Max Consecutive Words)
  const worst10 = [...validResults]
    .sort((a, b) => b.overlap5Gram - a.overlap5Gram || b.maxConsecutiveWords - a.maxConsecutiveWords)
    .slice(0, 10);

  console.log("⚠️ TOP 10 WORST OVERLAP OFFENDERS (Ranked by 5-gram overlap & consecutive run):");
  worst10.forEach((r, i) => {
    console.log(
      `${(i + 1).toString().padStart(2, " ")}. [${(r.overlap5Gram * 100).toFixed(1)}% 5-gram | ${(r.overlap3Gram * 100).toFixed(1)}% 3-gram | run: ${r.maxConsecutiveWords} words] ${r.slug}`,
    );
  });
  console.log("================================================================================\n");

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Fatal error in originality baseline:", err);
  process.exit(1);
});
