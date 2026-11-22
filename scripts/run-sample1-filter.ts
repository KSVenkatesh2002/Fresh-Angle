import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import * as fs from "fs";
import * as path from "path";
import { stepResearch } from "../src/services/pipeline/steps/research";
import { TopicCandidate } from "../src/services/research/topics";
import {
  extractDistinctiveTopicTerms,
  isResearchOrientedTopic,
  verifyRelevanceWithLLM,
} from "../src/services/research/relevance";
import { TavilyClient, getHostname } from "../src/services/research/tavily";

const sample1Topic: TopicCandidate = {
  title: "Provable Inference for LLMs: Anthropic's FlashProve Breakthrough",
  url: "https://www.anthropic.com/research/provable-inference",
  sourceFeed: "Anthropic Research",
  category: "Frontier Models & LLMs",
  relevanceScore: 96,
  snippet: "Anthropic introduces FlashProve for formal verification and provable guarantees in model generation.",
};

async function run() {
  console.log("================================================================================");
  console.log("🔬 RE-RUNNING SAMPLE 1 MULTI-SOURCE RESEARCH WITH RELEVANCE FILTER");
  console.log("================================================================================\n");

  const distinctiveTerms = extractDistinctiveTopicTerms(sample1Topic.title);
  const isResearch = isResearchOrientedTopic(sample1Topic.title);

  console.log(`Topic: "${sample1Topic.title}"`);
  console.log(`Catalyst URL: ${sample1Topic.url}`);
  console.log(`Distinctive Non-Brand Terms: [${distinctiveTerms.join(", ")}]`);
  console.log(`Is Research-Oriented: ${isResearch}\n`);

  // Run the full stepResearch
  const research = await stepResearch(sample1Topic);

  // Also query Tavily directly to trace all candidates (both chosen and dropped)
  const client = new TavilyClient();
  const baselineQuery = `${distinctiveTerms.slice(0, 3).join(" ")} architecture overview technical documentation`;
  const communityQuery = `${distinctiveTerms.slice(0, 3).join(" ")} review limitations benchmarks discussion`;

  const rawBaseline = await client.search(baselineQuery, { searchDepth: "basic", maxResults: 4 });
  const rawCommunity = await client.search(communityQuery, { searchDepth: "basic", maxResults: 4 });

  let md = "# Sample 1 Multi-Source Relevance Filter Audit\n\n";
  md += `**Topic:** \`${sample1Topic.title}\`\n`;
  md += `**Primary URL:** \`${sample1Topic.url}\`\n`;
  md += `**Non-Brand Distinctive Terms Identified:** ${distinctiveTerms.map((t) => `\`${t}\``).join(", ")} *(brand name 'Anthropic' explicitly stripped)*\n`;
  md += `**Research-Oriented Flag:** \`${isResearch}\`\n\n`;

  md += `## 1. Candidate Source Evaluation (Chosen vs. Dropped)\n\n`;
  md += `| Source Title | Publisher / Domain | Type | Score | Distinctive Term Hits | LLM Verified | Status | Reason |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

  const evaluatedUrls = new Set<string>();

  async function auditCandidate(r: { title: string; url: string; content: string; score: number }, type: string) {
    if (evaluatedUrls.has(r.url)) return;
    evaluatedUrls.add(r.url);

    const domain = getHostname(r.url);
    const text = (r.title + " " + r.content).toLowerCase();
    const hits = distinctiveTerms.filter((term) => text.includes(term));
    const termHitsStr = hits.length > 0 ? hits.join(", ") : "0 hits";

    if (r.url === sample1Topic.url || domain === "anthropic.com") {
      md += `| ${r.title.slice(0, 45)}... | \`${domain}\` | ${type} | ${r.score.toFixed(2)} | ${hits.length} (${termHitsStr}) | - | **DROPPED** | Same domain as primary source (domain dedupe) |\n`;
      return;
    }

    if (r.score < 0.65) {
      md += `| ${r.title.slice(0, 45)}... | \`${domain}\` | ${type} | ${r.score.toFixed(2)} | ${hits.length} (${termHitsStr}) | - | **DROPPED** | Low Tavily score (< 0.65) |\n`;
      return;
    }

    if (hits.length < 2) {
      md += `| ${r.title.slice(0, 45)}... | \`${domain}\` | ${type} | ${r.score.toFixed(2)} | ${hits.length} (${termHitsStr}) | - | **DROPPED** | Lacks 2+ distinctive non-brand topic terms |\n`;
      return;
    }

    const llmCheck = await verifyRelevanceWithLLM(sample1Topic.title, r.title, r.content.slice(0, 300));
    if (!llmCheck.relevant) {
      md += `| ${r.title.slice(0, 45)}... | \`${domain}\` | ${type} | ${r.score.toFixed(2)} | ${hits.length} (${termHitsStr}) | ❌ No | **DROPPED** | LLM: ${llmCheck.reason} |\n`;
      return;
    }

    md += `| ${r.title.slice(0, 45)}... | \`${domain}\` | ${type} | ${r.score.toFixed(2)} | ${hits.length} (${termHitsStr}) | ✅ Yes | **CHOSEN** | Passed score, 2+ terms, and LLM relevance |\n`;
  }

  for (const r of rawBaseline) {
    await auditCandidate(r, "Baseline Search");
  }
  for (const r of rawCommunity) {
    await auditCandidate(r, "Community Search");
  }

  md += `\n## 2. Final Selected Sources in Research Dossier\n\n`;
  md += `Total Sources Assembled: **${research.sources.length}** (Depth: \`${research.researchDepth}\`)\n\n`;
  for (let idx = 0; idx < research.sources.length; idx++) {
    const s = research.sources[idx];
    md += `### Source ${idx + 1}: ${s.title}\n`;
    md += `- **URL:** \`${s.url}\`\n`;
    md += `- **Publisher:** ${s.publisher}\n`;
    md += `- **Role:** \`${s.role || "primary"}\`\n`;
    md += `- **Length:** ${s.content.length.toLocaleString()} characters\n`;
    md += `- **Excerpt:**\n> ${s.content.slice(0, 200).replace(/\n/g, " ")}...\n\n`;
  }

  const outDir = path.resolve("scripts/out");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "sample1-sources-filter.md");
  fs.writeFileSync(outPath, md, "utf-8");

  console.log(`\n================================================================================`);
  console.log(`✓ Sample 1 sources filter report saved to: ${outPath}`);
  console.log(`================================================================================\n`);
}

run().catch((err) => {
  console.error("Error in run-sample1-filter:", err);
  process.exit(1);
});

