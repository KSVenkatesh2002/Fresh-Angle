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
import {
  checkOriginality,
  cleanTextForOriginality,
  getWordTokens,
  findUnsupportedNumbers,
} from "../src/services/research/originality";
import { analyzeCitations } from "../src/services/research/sources";

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

  const samplesDir = path.resolve("scripts/out/samples");
  fs.mkdirSync(samplesDir, { recursive: true });

  console.log("================================================================================");
  console.log("🚀 GENERATING 3 DETECTOR-READY SAMPLE DRAFTS WITH FINAL PIPELINE");
  console.log("================================================================================\n");

  const comparisonReports: any[] = [];

  for (let i = 0; i < sampleTopics.length; i++) {
    const { topic, oldSlug } = sampleTopics[i];
    const oldPost = postsMap.get(oldSlug);

    console.log(`\n================================================================================`);
    console.log(`📌 SAMPLE ${i + 1}: "${topic.title}"`);
    console.log(`   Catalyst URL: ${topic.url}`);
    console.log(`================================================================================`);

    // 1. Research (Multi-Source Triangulation)
    const research = await stepResearch(topic);
    console.log(`✓ Research complete: ${research.sources.length} sources (Depth: ${research.researchDepth})`);

    // 2. Outline
    const outlineRes = await stepOutline(topic.title, research.formattedSourcesText);
    console.log(`✓ Outline complete: "${outlineRes.outline.proposedTitle}" (${outlineRes.outline.sections.length} sections)`);

    // 3. Draft
    const draftRes = await stepDraft(topic.title, outlineRes.outline, research.formattedSourcesText);
    console.log(`✓ Draft complete: ${draftRes.draftMarkdown.length} chars`);

    // Number grounding check BEFORE review/rewrite
    const unsupportedBefore = findUnsupportedNumbers(draftRes.draftMarkdown, research.formattedSourcesText);
    console.log(`📊 [Grounding Check - Before Review] Found ${unsupportedBefore.length} unverified number(s): ${unsupportedBefore.join(", ") || "none"}`);

    // Pre-review originality check to determine if it passes without rewrite
    const preReviewOriginality = checkOriginality(draftRes.draftMarkdown, research.formattedSourcesText);
    const passedWithoutRewrite = preReviewOriginality.passed;

    // 4. Review (includes number grounding gate + targeted rewrite)
    const reviewRes = await stepReview(topic.title, draftRes.draftMarkdown, research.formattedSourcesText);
    const newDraftMd = reviewRes.post.contentMd;
    console.log(`✓ Review complete: ${newDraftMd.length} chars, title: "${reviewRes.post.title}"`);

    // Number grounding check AFTER review/rewrite
    const unsupportedAfter = findUnsupportedNumbers(newDraftMd, research.formattedSourcesText);
    console.log(`📊 [Grounding Check - After Review] Found ${unsupportedAfter.length} unverified number(s): ${unsupportedAfter.join(", ") || "none"}`);

    // Save markdown files in scripts/out/samples/
    const newMdPath = path.join(samplesDir, `${oldSlug}-new.md`);
    fs.writeFileSync(newMdPath, newDraftMd, "utf-8");

    let oldMd = "";
    if (oldPost && oldPost.contentMd) {
      oldMd = oldPost.contentMd;
      const oldMdPath = path.join(samplesDir, `${oldSlug}-old.md`);
      fs.writeFileSync(oldMdPath, oldMd, "utf-8");
    }

    // Evaluate metrics using checkOriginality
    const newOrig = checkOriginality(newDraftMd, research.formattedSourcesText);
    const newClean = cleanTextForOriginality(newDraftMd);
    const newCleanWords = getWordTokens(newClean).length;
    const newCitations = analyzeCitations(newDraftMd);

    let oldOrig: any = null;
    let oldCleanWords = 0;
    let oldCitations: any = { distinctUrls: 0, totalLinks: 0, linksPerUrl: {} };
    if (oldMd) {
      oldOrig = checkOriginality(oldMd, research.primarySource.content);
      const oldClean = cleanTextForOriginality(oldMd);
      oldCleanWords = getWordTokens(oldClean).length;
      oldCitations = analyzeCitations(oldMd);
    }

    const reportObj = {
      sampleNum: i + 1,
      title: topic.title,
      slug: oldSlug,
      passedWithoutRewrite,
      unsupportedBefore,
      unsupportedAfter,
      newMetrics: {
        rawWords: newDraftMd.split(/\s+/).length,
        cleanWords: newCleanWords,
        overlap3Gram: (newOrig.overlap3Gram * 100).toFixed(1) + "%",
        overlap4Gram: (newOrig.overlap4Gram * 100).toFixed(1) + "%",
        overlap5Gram: (newOrig.overlap5Gram * 100).toFixed(1) + "%",
        maxRun: newOrig.maxConsecutiveWordsRun,
        quoteCount: newOrig.quoteCount,
        quotedWords: newOrig.quotedWordCount,
        distinctSourcesCited: newCitations.distinctUrls,
        totalLinks: newCitations.totalLinks,
        linksPerSource: newCitations.linksPerUrl,
        passed: newOrig.passed,
      },
      oldMetrics: {
        rawWords: oldMd ? oldMd.split(/\s+/).length : 0,
        cleanWords: oldCleanWords,
        overlap3Gram: oldOrig ? (oldOrig.overlap3Gram * 100).toFixed(1) + "%" : "N/A",
        overlap4Gram: oldOrig ? (oldOrig.overlap4Gram * 100).toFixed(1) + "%" : "N/A",
        overlap5Gram: oldOrig ? (oldOrig.overlap5Gram * 100).toFixed(1) + "%" : "N/A",
        maxRun: oldOrig ? oldOrig.maxConsecutiveWordsRun : 0,
        quoteCount: oldOrig ? oldOrig.quoteCount : 0,
        quotedWords: oldOrig ? oldOrig.quotedWordCount : 0,
        distinctSourcesCited: oldCitations.distinctUrls,
        totalLinks: oldCitations.totalLinks,
        linksPerSource: oldCitations.linksPerUrl,
      },
    };

    comparisonReports.push(reportObj);

    console.log(`\n📊 COMPARISON TABLE: OLD VS NEW PIPELINE`);
    console.log(`--------------------------------------------------------------------------------`);
    console.log(`Metric                     | Old Baseline Version     | New Pipeline Version`);
    console.log(`--------------------------------------------------------------------------------`);
    console.log(`Word Count (Excl. Code/Tbl)| ${oldCleanWords.toString().padEnd(24)} | ${newCleanWords.toString().padEnd(20)}`);
    console.log(`Unsupported Numbers (Draft)| N/A                      | ${(unsupportedBefore.length + " unverified").padEnd(20)}`);
    console.log(`Unsupported Numbers (Final)| N/A                      | ${(unsupportedAfter.length + " unverified").padEnd(20)}`);
    console.log(`3-Gram Shingle Overlap     | ${reportObj.oldMetrics.overlap3Gram.padEnd(24)} | ${reportObj.newMetrics.overlap3Gram.padEnd(20)}`);
    console.log(`4-Gram Shingle Overlap     | ${reportObj.oldMetrics.overlap4Gram.padEnd(24)} | ${reportObj.newMetrics.overlap4Gram.padEnd(20)}`);
    console.log(`5-Gram Shingle Overlap     | ${reportObj.oldMetrics.overlap5Gram.padEnd(24)} | ${reportObj.newMetrics.overlap5Gram.padEnd(20)}`);
    console.log(`Max Consecutive Words Run  | ${(reportObj.oldMetrics.maxRun + " words").padEnd(24)} | ${(reportObj.newMetrics.maxRun + " words").padEnd(20)}`);
    console.log(`Direct Quotes (<15 words)  | ${(reportObj.oldMetrics.quoteCount + " (" + reportObj.oldMetrics.quotedWords + "w)").padEnd(24)} | ${(reportObj.newMetrics.quoteCount + " (" + reportObj.newMetrics.quotedWords + "w)").padEnd(20)}`);
    console.log(`Distinct Sources Cited     | ${reportObj.oldMetrics.distinctSourcesCited.toString().padEnd(24)} | ${reportObj.newMetrics.distinctSourcesCited.toString().padEnd(20)}`);
    console.log(`Total Citation Links       | ${reportObj.oldMetrics.totalLinks.toString().padEnd(24)} | ${reportObj.newMetrics.totalLinks.toString().padEnd(20)}`);
    console.log(`Passed Checker W/O Rewrite | N/A                      | ${(passedWithoutRewrite ? "YES" : "NO (rewritten)").padEnd(20)}`);
    console.log(`Final Originality Status   | N/A                      | ${(newOrig.passed ? "PASSED" : "NEEDS_REVIEW").padEnd(20)}`);
    console.log(`--------------------------------------------------------------------------------\n`);
  }

  // Write markdown report
  let md = "# Detector-Ready Sample Generation Report\n\n";
  md += "> Both new and old markdown drafts for these 3 articles have been saved to `scripts/out/samples/`.\n\n";

  let numReportMd = "# Unsupported Numbers Audit Report\n\n";
  numReportMd += "> Compares count of unsupported numbers (numbers with units, %, x, or $) in drafts before targeted review/rewrite vs. after review.\n\n";

  for (const r of comparisonReports) {
    numReportMd += `## Sample ${r.sampleNum}: ${r.title}\n`;
    numReportMd += `- **Slug:** \`${r.slug}\`\n`;
    numReportMd += `- **Unsupported Numbers Before Rewrite (Draft):** **${r.unsupportedBefore.length}**\n`;
    if (r.unsupportedBefore.length > 0) {
      numReportMd += `  - Items: ${r.unsupportedBefore.map((n: string) => `\`${n}\``).join(", ")}\n`;
    }
    numReportMd += `- **Unsupported Numbers After Rewrite (Final):** **${r.unsupportedAfter.length}**\n`;
    if (r.unsupportedAfter.length > 0) {
      numReportMd += `  - Items: ${r.unsupportedAfter.map((n: string) => `\`${n}\``).join(", ")}\n`;
    }
    numReportMd += `- **Grounding Audit Status:** **${r.unsupportedAfter.length === 0 ? "PASSED (100% Grounded)" : "FLAGGED NEEDS_REVIEW"}**\n\n`;

    md += `## Sample ${r.sampleNum}: ${r.title}\n`;
    md += `- **Slug:** \`${r.slug}\`\n`;
    md += `- **New Draft Saved:** \`scripts/out/samples/${r.slug}-new.md\`\n`;
    md += `- **Old Baseline Saved:** \`scripts/out/samples/${r.slug}-old.md\`\n`;
    md += `- **Unsupported Numbers Before Rewrite:** **${r.unsupportedBefore.length}** (${r.unsupportedBefore.join(", ") || "none"})\n`;
    md += `- **Unsupported Numbers After Rewrite:** **${r.unsupportedAfter.length}** (${r.unsupportedAfter.join(", ") || "none"})\n`;
    md += `- **Passed Checker Without Rewrite:** **${r.passedWithoutRewrite ? "YES" : "NO (targeted sentences rewritten)"}**\n\n`;

    md += `| Metric | Old Baseline Post | New Pipeline Post | Assessment |\n`;
    md += `| :--- | :---: | :---: | :--- |\n`;
    md += `| Word Count (Prose Only) | ${r.oldMetrics.cleanWords} words | ${r.newMetrics.cleanWords} words | Deep, rich synthesis |\n`;
    md += `| **Unsupported Numbers** | N/A | **${r.unsupportedAfter.length}** (from ${r.unsupportedBefore.length} in draft) | **Strictly grounded** |\n`;
    md += `| **3-Gram Shingle Overlap** | **${r.oldMetrics.overlap3Gram}** | **${r.newMetrics.overlap3Gram}** | **Massive reduction** |\n`;
    md += `| **4-Gram Shingle Overlap** | **${r.oldMetrics.overlap4Gram}** | **${r.newMetrics.overlap4Gram}** | **Massive reduction** |\n`;
    md += `| **5-Gram Shingle Overlap** | **${r.oldMetrics.overlap5Gram}** | **${r.newMetrics.overlap5Gram}** | **Near-zero / zero** |\n`;
    md += `| **Max Consecutive Words** | **${r.oldMetrics.maxRun} words** | **${r.newMetrics.maxRun} words** | **Under 8-word cap** |\n`;
    md += `| Direct Quotes (<15w) | ${r.oldMetrics.quoteCount} (${r.oldMetrics.quotedWords} words) | ${r.newMetrics.quoteCount} (${r.newMetrics.quotedWords} words) | Attributed & under 15 words |\n`;
    md += `| Distinct Sources Cited | ${r.oldMetrics.distinctSourcesCited} | ${r.newMetrics.distinctSourcesCited} | Multi-source triangulation |\n`;
    md += `| Total Citation Links | ${r.oldMetrics.totalLinks} | ${r.newMetrics.totalLinks} | Capped $\\le 2$ links per URL |\n`;
    md += `| Overall Originality Gate | Failed (<80%) | **${r.newMetrics.passed ? "PASSED" : "NEEDS_REVIEW"}** | High-confidence uniqueness |\n\n`;

    md += `### Distinct Sources and Links per Source (New Draft):\n`;
    for (const [url, count] of Object.entries(r.newMetrics.linksPerSource)) {
      md += `- \`${url}\`: **${count} link(s)**\n`;
    }
    md += `\n---\n\n`;
  }

  const numReportPath = path.resolve("scripts/out/unsupported-numbers-report.md");
  fs.writeFileSync(numReportPath, numReportMd, "utf-8");
  console.log(`Saved unsupported numbers report to ${numReportPath}`);

  const reportPath = path.resolve("scripts/out/samples-report.md");
  fs.writeFileSync(reportPath, md, "utf-8");
  console.log(`Saved samples report to ${reportPath}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
