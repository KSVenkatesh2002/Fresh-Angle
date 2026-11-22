import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import * as fs from "fs";
import * as path from "path";
import { stepResearch } from "../src/services/pipeline/steps/research";
import { stepOutline } from "../src/services/pipeline/steps/outline";
import { stepDraft } from "../src/services/pipeline/steps/draft";
import { stepReview } from "../src/services/pipeline/steps/review";
import { TopicCandidate } from "../src/services/research/topics";

function cleanText(contentMd: string): string {
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

function getWordTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function getNGramShingles(words: string[], k: number): Set<string> {
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

function computeOverlap(postShingles: Set<string>, sourceShingles: Set<string>): number {
  if (postShingles.size === 0) return 0;
  let matches = 0;
  for (const s of postShingles) {
    if (sourceShingles.has(s)) matches++;
  }
  return matches / postShingles.size;
}

function findMaxConsecutiveMatchingWords(postWords: string[], sourceWords: string[]): number {
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

function countCitations(md: string): number {
  const matches = md.match(/\[[^\]]+\]\(https?:\/\/[^\)]+\)/g);
  return matches ? matches.length : 0;
}

function countQuotes(md: string): { count: number; longestQuoteWords: number } {
  const quoteMatches = md.match(/"([^"]{10,250})"/g) || [];
  let longest = 0;
  for (const q of quoteMatches) {
    const words = q.split(/\s+/).length;
    if (words > longest) longest = words;
  }
  return { count: quoteMatches.length, longestQuoteWords: longest };
}

const sampleTopics: Array<{ topic: TopicCandidate; oldSlug: string }> = [
  {
    topic: {
      title: "Provable Inference for LLMs: Anthropic's FlashProve Breakthrough",
      url: "https://www.anthropic.com/research/provable-inference",
      sourceFeed: "Anthropic Research",
      category: "Frontier Models & LLMs",
      relevanceScore: 96,
      snippet: "Anthropic introduces FlashProve for formal verification and provable guarantees in model generation.",
    },
    oldSlug: "provable-inference-llms-flashprove",
  },
  {
    topic: {
      title: "Gemini Omni 1.2 Flash Delivers Native 15-Second Video Generation",
      url: "https://blog.google/innovation-and-ai/technology/developers-tools/introducing-gemini-omni-1-2-flash/",
      sourceFeed: "Google AI Blog",
      category: "Artificial Intelligence",
      relevanceScore: 94,
      snippet: "Google introduces Gemini Omni 1.2 Flash with native video generation capabilities and low-latency inference.",
    },
    oldSlug: "gemini-omni-1-2-flash-video-generation",
  },
  {
    topic: {
      title: "Architecting GPU Infrastructure with NVIDIA Kubernetes Engine",
      url: "https://github.com/dsx-ai-factory/nvke",
      sourceFeed: "GitHub Trending",
      category: "Hardware & Silicon",
      relevanceScore: 91,
      snippet: "NVIDIA Kubernetes Engine architecture for automated GPU clustering, network fabric, and cluster orchestration.",
    },
    oldSlug: "architecting-gpu-infrastructure-with-nvidia-kubernetes-engine",
  },
];

async function run() {
  const backupPath = path.resolve("backups/backup-2026-11-22T17-09-45-646Z.json");
  const backupData = JSON.parse(fs.readFileSync(backupPath, "utf-8"));
  const postsMap = new Map<string, any>();
  for (const p of backupData.tables?.posts || []) {
    postsMap.set(p.slug, p);
  }

  console.log("================================================================================");
  console.log("🚀 GENERATING 3 SAMPLE DRAFTS WITH NEW PIPELINE (DRY RUN: NO PUBLISH, NO PUSH)");
  console.log("================================================================================\n");

  for (let i = 0; i < sampleTopics.length; i++) {
    const { topic, oldSlug } = sampleTopics[i];
    const oldPost = postsMap.get(oldSlug);

    console.log(`\n================================================================================`);
    console.log(`📌 SAMPLE ${i + 1}: "${topic.title}"`);
    console.log(`   Catalyst URL: ${topic.url}`);
    console.log(`================================================================================`);

    // 1. Research
    const research = await stepResearch(topic);
    console.log(`✓ Research complete: ${research.sources.length} sources (Depth: ${research.researchDepth})`);

    // 2. Outline
    const outlineRes = await stepOutline(topic.title, research.formattedSourcesText);
    console.log(`✓ Outline complete: "${outlineRes.outline.proposedTitle}" (${outlineRes.outline.sections.length} sections)`);

    // 3. Draft
    const draftRes = await stepDraft(topic.title, outlineRes.outline, research.formattedSourcesText);
    console.log(`✓ Draft complete: ${draftRes.draftMarkdown.length} chars`);

    // 4. Review
    const reviewRes = await stepReview(topic.title, draftRes.draftMarkdown, research.formattedSourcesText);
    const newDraftMd = reviewRes.post.contentMd;
    console.log(`✓ Review complete: ${newDraftMd.length} chars, title: "${reviewRes.post.title}"`);

    // Primary source word tokens for overlap
    const primarySourceWords = getWordTokens(research.primarySource.content);
    const primary3Grams = getNGramShingles(primarySourceWords, 3);
    const primary4Grams = getNGramShingles(primarySourceWords, 4);
    const primary5Grams = getNGramShingles(primarySourceWords, 5);

    // New version metrics
    const newCleanText = cleanText(newDraftMd);
    const newWords = getWordTokens(newCleanText);
    const newWordCount = newDraftMd.split(/\s+/).length;
    const new3Gram = computeOverlap(getNGramShingles(newWords, 3), primary3Grams) * 100;
    const new4Gram = computeOverlap(getNGramShingles(newWords, 4), primary4Grams) * 100;
    const new5Gram = computeOverlap(getNGramShingles(newWords, 5), primary5Grams) * 100;
    const newMaxRun = findMaxConsecutiveMatchingWords(newWords, primarySourceWords);
    const newCitations = countCitations(newDraftMd);
    const newQuotes = countQuotes(newDraftMd);
    const hasTable = newDraftMd.includes("|") && newDraftMd.includes("---");
    const hasDiagram = newDraftMd.includes("```text") || newDraftMd.includes("+--") || newDraftMd.includes("|   |");
    const hasTradeoffs = /trade-?offs?\s+and\s+limitations/i.test(newDraftMd);

    // Old version metrics
    let oldWordCount = 0;
    let old3Gram = 0;
    let old4Gram = 0;
    let old5Gram = 0;
    let oldMaxRun = 0;
    let oldCitations = 0;
    let oldQuotes = { count: 0, longestQuoteWords: 0 };
    let oldHasTradeoffs = false;

    if (oldPost) {
      const oldClean = cleanText(oldPost.contentMd);
      const oldWords = getWordTokens(oldClean);
      oldWordCount = oldPost.contentMd.split(/\s+/).length;
      old3Gram = computeOverlap(getNGramShingles(oldWords, 3), primary3Grams) * 100;
      old4Gram = computeOverlap(getNGramShingles(oldWords, 4), primary4Grams) * 100;
      old5Gram = computeOverlap(getNGramShingles(oldWords, 5), primary5Grams) * 100;
      oldMaxRun = findMaxConsecutiveMatchingWords(oldWords, primarySourceWords);
      oldCitations = countCitations(oldPost.contentMd);
      oldQuotes = countQuotes(oldPost.contentMd);
      oldHasTradeoffs = /trade-?offs?\s+and\s+limitations/i.test(oldPost.contentMd);
    }

    console.log(`\n📊 COMPARISON TABLE: OLD VS NEW PIPELINE`);
    console.log(`--------------------------------------------------------------------------------`);
    console.log(`Metric                     | Old Baseline Version     | New Pipeline Version`);
    console.log(`--------------------------------------------------------------------------------`);
    console.log(`Word Count                 | ${oldWordCount.toString().padEnd(24)} | ${newWordCount.toString().padEnd(20)}`);
    console.log(`3-Gram Shingle Overlap     | ${(old3Gram.toFixed(1) + "%").padEnd(24)} | ${(new3Gram.toFixed(1) + "%").padEnd(20)}`);
    console.log(`4-Gram Shingle Overlap     | ${(old4Gram.toFixed(1) + "%").padEnd(24)} | ${(new4Gram.toFixed(1) + "%").padEnd(20)}`);
    console.log(`5-Gram Shingle Overlap     | ${(old5Gram.toFixed(1) + "%").padEnd(24)} | ${(new5Gram.toFixed(1) + "%").padEnd(20)}`);
    console.log(`Max Consecutive Words Run  | ${(oldMaxRun + " words").padEnd(24)} | ${(newMaxRun + " words").padEnd(20)}`);
    console.log(`Inline Citation Links      | ${oldCitations.toString().padEnd(24)} | ${newCitations.toString().padEnd(20)}`);
    console.log(`Direct Quotes (<15 words)  | ${(oldQuotes.count + " (max " + oldQuotes.longestQuoteWords + "w)").padEnd(24)} | ${(newQuotes.count + " (max " + newQuotes.longestQuoteWords + "w)").padEnd(20)}`);
    console.log(`Trade-offs Section         | ${(oldHasTradeoffs ? "YES" : "NO").padEnd(24)} | ${(hasTradeoffs ? "YES ('Our take:')" : "NO").padEnd(20)}`);
    console.log(`Comparison Matrix Table    | YES                      | ${(hasTable ? "YES" : "NO").padEnd(20)}`);
    console.log(`ASCII Architecture Diagram | NO                       | ${(hasDiagram ? "YES" : "NO").padEnd(20)}`);
    console.log(`--------------------------------------------------------------------------------\n`);
  }
}

run().catch((e) => {
  console.error("Draft generation failed:", e);
  process.exit(1);
});
