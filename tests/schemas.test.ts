import { describe, it, expect } from "vitest";
import { outlineSchema, postReviewSchema } from "@/services/pipeline/schemas";

describe("AI Output Schema Validation", () => {
  it("validates a compliant structured outline", () => {
    const validOutline = {
      proposedTitle:
        "Inside DeepSeek R1: Architectural Breakthroughs in Reasoning",
      thesis:
        "DeepSeek R1 proves pure reinforcement learning can induce emergent reasoning.",
      targetCategory: "Frontier Models & LLMs",
      sections: [
        {
          heading: "Incentivizing Reasoning Without Supervised Fine-Tuning",
          keyPoints: [
            "Rule-based reward modeling",
            "Cold-start data generation",
          ],
        },
        {
          heading: "Distillation of Reasoning to Dense Architectures",
          keyPoints: [
            "Transferring chain-of-thought to smaller student models",
          ],
        },
        {
          heading: "Implications for Open Source Research",
          keyPoints: ["Commoditization of reasoning tokens"],
        },
      ],
    };

    const result = outlineSchema.safeParse(validOutline);
    expect(result.success).toBe(true);
  });

  it("rejects an outline with insufficient sections or missing fields", () => {
    const invalidOutline = {
      proposedTitle: "Short",
      sections: [],
    };

    const result = outlineSchema.safeParse(invalidOutline);
    expect(result.success).toBe(false);
  });

  it("validates a fully reviewed editorial post object", () => {
    const validPost = {
      title: "DeepSeek R1 Reasoning Architecture Explored",
      excerpt:
        "An in-depth analysis into how rule-based rewards trigger reasoning capabilities in frontier models.",
      contentMd:
        "## Executive Summary\n\nDeepSeek R1 demonstrates a profound shift in training methodology by showing that self-evolution through reinforcement learning can develop chain-of-thought reasoning without human demonstration data. Here we examine the engineering choices behind this landmark release.\n\n## Technical Implementation\n\nThe training regimen leverages large-scale actor-critic optimization with verifiable reward signals.",
      metaTitle: "DeepSeek R1 Architecture & Benchmarks",
      metaDescription:
        "A technical deep dive into DeepSeek R1 reasoning and distillation mechanisms.",
      category: "Frontier Models & LLMs",
      tags: ["deepseek", "reasoning", "reinforcement-learning", "open-source"],
      slug: "deepseek-r1-reasoning-architecture-explored",
      imagePrompt:
        "A glowing neural network lattice evolving complex thought patterns, digital editorial illustration, dark background, 8k resolution",
      imageAlt: "Visualization of emergent neural network reasoning lattice",
      faq: [
        {
          question: "What is the primary breakthrough of DeepSeek R1?",
          answer:
            "It proved that reasoning can be induced via pure reinforcement learning using verification rewards.",
        },
        {
          question: "Are model weights publicly available?",
          answer:
            "Yes, weights for both base and distilled models are open-sourced under permissive licenses.",
        },
      ],
    };

    const result = postReviewSchema.safeParse(validPost);
    expect(result.success).toBe(true);
  });

  it("rejects post output if meta title or meta description exceeds max limit", () => {
    const invalidPost = {
      title: "Title",
      excerpt:
        "Excerpt that is at least thirty characters long for validation.",
      contentMd:
        "Long content that satisfies minimum length requirements for testing purposes...",
      metaTitle:
        "This meta title is intentionally way too long and exceeds the strict sixty character limit",
      metaDescription: "Valid meta description under limit.",
      category: "AI",
      tags: ["a", "b", "c"],
      slug: "test-slug",
      imagePrompt: "Long prompt here for generation testing",
      imageAlt: "Alt text describing image",
      faq: [
        { question: "Q?", answer: "A lengthy answer that passes validation." },
      ],
    };

    const result = postReviewSchema.safeParse(invalidPost);
    expect(result.success).toBe(false);
  });
});
