import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import { getDb } from "./client";
import {
  categories,
  tags,
  automationSettings,
  feeds,
  usageLimits,
  promptTemplates,
  settings,
} from "./schema";
import { slugify } from "@/lib/utils/slug";
import { TOPIC_FEEDS } from "@/config/feeds";
import {
  SYSTEM_EDITORIAL_PERSONA,
  buildOutlinePrompt,
  buildDraftPrompt,
  buildReviewPrompt,
} from "@/services/pipeline/prompts/templates";

const SEED_CATEGORIES = [
  {
    name: "Artificial Intelligence",
    description:
      "Foundational breakthroughs, general intelligence research, and societal implications.",
    introText:
      "Welcome to the Artificial Intelligence hub. Here we dissect major architectural milestones, frontier capabilities, and safety research transforming the computational landscape.",
  },
  {
    name: "Frontier Models & LLMs",
    description:
      "Deep dives into modern large language models, reasoning engines, and transformer architectures.",
    introText:
      "Analysis of bleeding-edge frontier LLMs, reasoning models, multimodal benchmarks, and open-weights releases.",
  },
  {
    name: "Machine Learning",
    description:
      "Practical algorithms, training methodology, fine-tuning, and open-source models.",
    introText:
      "Practical guides and deep dives on optimization, synthetic data pipelines, RLHF, and real-world ML deployment.",
  },
  {
    name: "Hardware & Silicon",
    description:
      "GPUs, TPUs, neural processing units, and high-performance computing clusters.",
    introText:
      "Accelerated computing, memory architectures, interconnects, and semiconductor developments powering global compute.",
  },
  {
    name: "Robotics & Embodied AI",
    description:
      "Physical autonomous systems, spatial intelligence, and robotic foundation models.",
    introText:
      "Exploring the intersection of vision-language-action models and humanoid robotics.",
  },
  {
    name: "Technology",
    description:
      "Broad technological advancements, developer ecosystems, and software infrastructure.",
    introText:
      "Comprehensive reporting on software architecture, cloud platforms, and developer tooling.",
  },
  {
    name: "Science",
    description:
      "Computational biology, quantum research, physics, and scientific computing.",
    introText:
      "Where scientific discovery meets computational scale: protein folding, quantum simulation, and advanced materials.",
  },
  {
    name: "Business",
    description:
      "Venture investments, AI economics, enterprise adoption, and tech market dynamics.",
    introText:
      "Economic analysis of the artificial intelligence boom, capex investments, and enterprise ROI.",
  },
  {
    name: "World",
    description:
      "Global regulations, geopolitical compute trade, and international policy.",
    introText:
      "Global governance, sovereign AI initiatives, and international compute supply chain policies.",
  },
];

const SEED_TAGS = [
  "Deep Learning",
  "LLM",
  "Open Source",
  "Reasoning",
  "Transformers",
  "Autonomous Agents",
  "NVIDIA",
  "Benchmarks",
  "Safety & Alignment",
  "Multimodal",
  "Cloud Infrastructure",
  "Silicon",
  "Robotics",
  "Enterprise AI",
];

export async function seed(): Promise<void> {
  console.log("🌱 Starting comprehensive database seeding...");
  const db = getDb();

  // 1. Categories
  for (const cat of SEED_CATEGORIES) {
    const slug = slugify(cat.name);
    await db
      .insert(categories)
      .values({
        slug,
        name: cat.name,
        description: cat.description,
        introText: cat.introText,
      })
      .onConflictDoNothing({ target: categories.slug });
    console.log(`  ✓ Category: ${cat.name}`);
  }

  // 2. Tags
  for (const tagName of SEED_TAGS) {
    const slug = slugify(tagName);
    await db
      .insert(tags)
      .values({
        slug,
        name: tagName,
      })
      .onConflictDoNothing({ target: tags.slug });
    console.log(`  ✓ Tag: ${tagName}`);
  }

  // 3. Automation Settings (Default row)
  const existingSettings = await db.select().from(automationSettings).limit(1);
  if (existingSettings.length === 0) {
    await db.insert(automationSettings).values({
      enabled: true,
      timezone: "Asia/Kolkata",
      mode: "auto_distribute",
      postsPerDay: 2,
      windowStart: "08:00",
      windowEnd: "22:00",
      fixedTimes: ["09:00", "18:00"],
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      weekdayOverrides: {},
      jitterMinutes: 15,
      publishMode: "auto",
      contentMode: "trending",
      categoryWeights: {},
      includeTags: [],
      excludeTags: [],
      includeKeywords: [],
      excludeKeywords: [],
      minWords: 700,
      targetLength: "medium",
      imageMode: "ai",
      maxPostsPerRun: 1,
      lateSlotGraceMinutes: 60,
      consecutiveFailures: 0,
    });
    console.log("  ✓ Initialized Automation Settings");
  }

  // 4. Feeds
  for (const f of TOPIC_FEEDS) {
    await db
      .insert(feeds)
      .values({
        url: f.url,
        name: f.name,
        enabled: true,
      })
      .onConflictDoNothing({ target: feeds.url });
    console.log(`  ✓ Feed: ${f.name}`);
  }

  // 5. Usage Limits
  const defaultLimits = [
    {
      provider: "groq",
      kind: "text" as const,
      dailyLimit: 500,
      monthlyLimit: 15000,
    },
    {
      provider: "gemini",
      kind: "text" as const,
      dailyLimit: 1000,
      monthlyLimit: 30000,
    },
    {
      provider: "openrouter",
      kind: "text" as const,
      dailyLimit: 200,
      monthlyLimit: 6000,
    },
    {
      provider: "cloudflare",
      kind: "image" as const,
      dailyLimit: 100,
      monthlyLimit: 3000,
    },
    {
      provider: "pexels",
      kind: "image" as const,
      dailyLimit: 200,
      monthlyLimit: 5000,
    },
  ];

  for (const limit of defaultLimits) {
    await db
      .insert(usageLimits)
      .values({
        provider: limit.provider,
        kind: limit.kind,
        dailyLimit: limit.dailyLimit,
        monthlyLimit: limit.monthlyLimit,
        softPercent: 80,
      })
      .onConflictDoNothing();
    console.log(`  ✓ Usage Limit: ${limit.provider} (${limit.kind})`);
  }

  // 6. Prompt Templates
  const defaultPrompts = [
    {
      name: "outline",
      version: "1.0.0",
      systemPrompt: SYSTEM_EDITORIAL_PERSONA,
      userPrompt: buildOutlinePrompt("{{TOPIC}}", "{{SOURCES}}"),
    },
    {
      name: "draft",
      version: "1.0.0",
      systemPrompt: SYSTEM_EDITORIAL_PERSONA,
      userPrompt: buildDraftPrompt("{{TOPIC}}", "{{OUTLINE}}", "{{SOURCES}}"),
    },
    {
      name: "review",
      version: "1.0.0",
      systemPrompt: SYSTEM_EDITORIAL_PERSONA,
      userPrompt: buildReviewPrompt("{{TOPIC}}", "{{DRAFT}}", "{{SOURCES}}"),
    },
  ];

  for (const pt of defaultPrompts) {
    await db.insert(promptTemplates).values(pt).onConflictDoNothing();
    console.log(`  ✓ Prompt Template: ${pt.name}`);
  }

  // 7. General Settings
  const defaultSettingsMap = [
    { key: "creator_name", value: "Venkatesh K S" },
    { key: "creator_url", value: "https://venkatesh-k-s.vercel.app" },
    { key: "creator_image", value: "/images/creator.png" },
    { key: "site_name", value: "Fresh Angle" },
    {
      key: "site_tagline",
      value: "Cutting-Edge AI & Tech Perspectives, Daily",
    },
    { key: "timezone", value: "Asia/Kolkata" },
  ];

  for (const s of defaultSettingsMap) {
    await db.insert(settings).values(s).onConflictDoNothing();
    console.log(`  ✓ Setting: ${s.key}`);
  }

  console.log("✅ Comprehensive database seeding complete!");
}

if (require.main === module || process.argv[1]?.includes("seed.ts")) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Seeding failed:", err);
      process.exit(1);
    });
}
