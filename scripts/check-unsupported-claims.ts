import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config();

import { stepResearch } from "../src/services/pipeline/steps/research";
import { TopicCandidate } from "../src/services/research/topics";

const sampleTopics: Array<{ topic: TopicCandidate; slug: string }> = [
  {
    slug: "provable-inference-llms-flashprove",
    topic: {
      title: "Provable Inference for LLMs: Anthropic's FlashProve Breakthrough",
      url: "https://www.anthropic.com/research/provable-inference",
      sourceFeed: "Anthropic Research",
      category: "Artificial Intelligence",
      relevanceScore: 100,
      snippet: "Anthropic introduces FlashProve, enabling provable inference for frontier models.",
    },
  },
  {
    slug: "gemini-omni-1-2-flash-video-generation",
    topic: {
      title: "Gemini Omni 1.2 Flash Delivers Native 15-Second Video Generation",
      url: "https://blog.google/innovation-and-ai/technology/developers-tools/introducing-gemini-omni-1-2-flash/",
      sourceFeed: "Google AI Blog",
      category: "Artificial Intelligence",
      relevanceScore: 98,
      snippet: "Google launches Gemini Omni 1.2 Flash with native video synthesis capabilities.",
    },
  },
  {
    slug: "architecting-gpu-infrastructure-with-nvidia-kubernetes-engine",
    topic: {
      title: "Architecting GPU Infrastructure with NVIDIA Kubernetes Engine",
      url: "https://github.com/dsx-ai-factory/nvke",
      sourceFeed: "Hacker News",
      category: "Artificial Intelligence",
      relevanceScore: 95,
      snippet: "NVIDIA Kubernetes Engine (NVKE) framework for scaling GPU cloud clusters.",
    },
  },
];

function extractNumbers(text: string): string[] {
  // Matches integers, floats, percentages, multipliers, currency
  const matches = text.match(/\b(?:\$?\d+(?:,\d+)*(?:\.\d+)?(?:%|x|k|m|b|gb|tb|ms|s)?)\b/gi) || [];
  const unique = Array.from(new Set(matches.map((m) => m.trim()))).filter((m) => {
    // Exclude markdown heading markers and table dividers
    return !/^#+$/.test(m) && m.length > 0;
  });
  return unique;
}

function extractNamedEntities(text: string): string[] {
  // Strip code blocks and URLs first
  const clean = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]+`/g, " ")
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/https?:\/\/[^\s\)]+/g, " ");

  // Extract Capitalized Phrases (2-4 words) or CamelCase/UPPERCASE acronyms
  const acronyms = clean.match(/\b[A-Z]{2,}(?:-[A-Z0-9]+)?\b/g) || [];
  const capitalizedPhrases = clean.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b/g) || [];

  const combined = Array.from(new Set([...acronyms, ...capitalizedPhrases])).filter((e) => {
    const lower = e.toLowerCase();
    // Filter out common sentence starters and generic editorial words
    const commonWords = [
      "the", "in", "this", "our take", "trade-offs", "limitations", "comparison matrix",
      "key takeaways", "table of contents", "overview", "architectural", "according to",
      "for example", "furthermore", "however", "moreover", "on the other hand",
    ];
    return !commonWords.includes(lower) && e.length > 2;
  });

  return combined;
}

async function run() {
  console.log("Analyzing unsupported claims (numbers and named entities) across 3 new drafts...\n");

  let md = "# Unsupported Claims Audit (Numbers & Named Entities)\n\n";
  md += "> Audit checking whether numbers and named entities in each of the 3 new drafts exist in the fetched source texts.\n\n";

  for (let i = 0; i < sampleTopics.length; i++) {
    const { slug, topic } = sampleTopics[i];
    const draftPath = path.resolve(`scripts/out/samples/${slug}-new.md`);

    if (!fs.existsSync(draftPath)) {
      console.warn(`Draft not found: ${draftPath}`);
      continue;
    }

    const draftText = fs.readFileSync(draftPath, "utf-8");

    // Fetch research sources
    console.log(`[Research] Gathering sources for ${slug}...`);
    const research = await stepResearch(topic);
    const combinedSourceText = research.sources.map((s) => `${s.title}\n${s.content}`).join("\n\n").toLowerCase();

    const draftNumbers = extractNumbers(draftText);
    const draftEntities = extractNamedEntities(draftText);

    const unsupportedNumbers: string[] = [];
    for (const num of draftNumbers) {
      // Check if num exists in source text (case-insensitive)
      const numClean = num.toLowerCase().replace(/,/g, "");
      const sourceClean = combinedSourceText.replace(/,/g, "");
      if (!sourceClean.includes(numClean)) {
        unsupportedNumbers.push(num);
      }
    }

    const unsupportedEntities: string[] = [];
    for (const ent of draftEntities) {
      const entClean = ent.toLowerCase();
      if (!combinedSourceText.includes(entClean)) {
        unsupportedEntities.push(ent);
      }
    }

    console.log(`- ${slug}: ${unsupportedNumbers.length} numbers and ${unsupportedEntities.length} entities not in source text.`);

    md += `## Sample ${i + 1}: \`${slug}\`\n\n`;
    md += `- **Catalyst URL:** ${topic.url}\n`;
    md += `- **Sources Fetched:** ${research.sources.length} sources (${research.sources.map((s) => `\`${s.url}\``).join(", ")})\n`;
    md += `- **Total Draft Numbers Extracted:** ${draftNumbers.length}\n`;
    md += `- **Unsupported Numbers:** **${unsupportedNumbers.length}**\n`;
    md += `- **Total Draft Named Entities Extracted:** ${draftEntities.length}\n`;
    md += `- **Unsupported Named Entities:** **${unsupportedEntities.length}**\n\n`;

    if (unsupportedNumbers.length > 0) {
      md += `### Numbers Not Appearing in Fetched Sources:\n`;
      md += unsupportedNumbers.map((n) => `- \`${n}\``).join("\n") + "\n\n";
    } else {
      md += `### Numbers Not Appearing in Fetched Sources: None (100% grounded)\n\n`;
    }

    if (unsupportedEntities.length > 0) {
      md += `### Named Entities Not Appearing in Fetched Sources:\n`;
      md += unsupportedEntities.map((e) => `- \`${e}\``).join("\n") + "\n\n";
    } else {
      md += `### Named Entities Not Appearing in Fetched Sources: None (100% grounded)\n\n`;
    }

    md += "---\n\n";
  }

  const outPath = path.resolve("scripts/out/unsupported-claims.md");
  fs.writeFileSync(outPath, md, "utf-8");
  console.log(`Saved unsupported claims report to ${outPath}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

