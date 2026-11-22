import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import { stepResearch } from "../src/services/pipeline/steps/research";
import { PIPELINE_CONFIG } from "../src/config/pipeline";

const topics = [
  {
    id: "dry-run-1",
    title: "Scaling Foundation Model Infrastructure: AWS Building Blocks for Modern AI",
    url: "https://huggingface.co/blog/amazon/foundation-model-building-blocks",
    score: 95,
    summary: "AWS building blocks and distributed training architectures for foundation models.",
    guidance: "infrastructure architecture",
    sourceFeed: "Hugging Face Blog",
    category: "Hardware & Silicon",
    relevanceScore: 95,
  },
  {
    id: "dry-run-2",
    title: "Optimizing LLM Reinforcement Learning on Consumer Hardware",
    url: "https://huggingface.co/blog/trl-peft",
    score: 92,
    summary: "Running RLHF / DPO fine-tuning on consumer-grade GPUs using PEFT and TRL.",
    guidance: "developer optimization",
    sourceFeed: "Hugging Face Blog",
    category: "Machine Learning",
    relevanceScore: 92,
  },
  {
    id: "dry-run-3",
    title: "Securing the Inference Layer: Analyzing Recent Data Processing Incidents",
    url: "https://openrouter.ai/blog/announcements/data-processing-incidents-on-inference-providers/",
    score: 90,
    summary: "API inference provider security, data leak vulnerabilities, and mitigations.",
    guidance: "security engineering",
    sourceFeed: "OpenRouter Blog",
    category: "Artificial Intelligence",
    relevanceScore: 90,
  },
];

async function run() {
  console.log("================================================================================");
  console.log("🔬 DRY RUN: STEP RESEARCH ON 3 RECENT TOPICS (NO DB WRITES, NO PUBLISHING)");
  console.log("================================================================================\n");

  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];
    console.log(`\n📌 TOPIC ${i + 1}: "${topic.title}"`);
    console.log(`   Catalyst URL: ${topic.url}`);

    const res = await stepResearch(topic);

    console.log(`\n   Triangulation Result:`);
    console.log(`   - Research Depth: ${res.researchDepth}`);
    console.log(`   - Total Sources Assembled: ${res.sources.length}`);
    console.log(`   - Total Prompt Characters: ${res.formattedSourcesText.length} chars (Cap: ${PIPELINE_CONFIG.limits.maxTotalResearchPromptChars})`);
    console.log(`   - Est. Prompt Tokens: ~${Math.round(res.formattedSourcesText.length / 4)} tokens\n`);

    console.log(`   Sources Breakdown by Pillar:`);
    res.sources.forEach((s, idx) => {
      let pillar = "PRIMARY CATALYST";
      let whyRelevant = "Original breaking announcement or catalyst document";

      if (s.role === "academic_baseline") {
        pillar = "BASELINE / CONTEXTUAL / PRIOR-ART";
        whyRelevant = "Foundational architecture, technical specifications, or prior documentation";
      } else if (s.role === "community_discussion") {
        pillar = "PRACTITIONER / COMMUNITY / BENCHMARKS";
        whyRelevant = "Independent critique, real-world benchmarks, practitioner limitations";
      }

      console.log(`   [Source ${idx + 1}] Pillar: ${pillar}`);
      console.log(`     Title: ${s.title}`);
      console.log(`     Publisher / Domain: ${s.publisher}`);
      console.log(`     URL: ${s.url}`);
      console.log(`     Length: ${s.content.length} chars`);
      console.log(`     Why Relevant: ${whyRelevant}`);
      console.log(`     Snippet: ${s.content.replace(/\s+/g, " ").trim().slice(0, 120)}...\n`);
    });
  }
}

run().catch((err) => {
  console.error("Dry run failed:", err);
  process.exit(1);
});
