import { describe, it, expect } from "vitest";
import {
  computeJaccardSimilarity,
  computeLevenshteinSimilarity,
  isDuplicateTopic,
  extractEntities,
  checkEntityCooldown,
  computeShingleSimilarity,
  checkContentSimilarity,
} from "@/services/research/dedupe";

describe("Similarity and Duplicate Detection", () => {
  it("computes high Jaccard similarity for overlapping word sets", () => {
    const textA = "OpenAI releases new reasoning model architecture";
    const textB = "OpenAI launches new reasoning model architecture";

    const sim = computeJaccardSimilarity(textA, textB);
    expect(sim).toBeGreaterThanOrEqual(0.6);
  });

  it("computes low similarity for distinct topics", () => {
    const textA = "OpenAI launches new reasoning model o3";
    const textB = "NVIDIA unveils quantum computing supercomputer architecture";

    const sim = computeJaccardSimilarity(textA, textB);
    expect(sim).toBeLessThan(0.2);
  });

  it("flags near-duplicate topics correctly", () => {
    const pastTitles = [
      "DeepSeek V3 Model Weights Released to Open Source Community",
      "Meta Introduces Llama 3 with 400B Parameters",
    ];

    const duplicateCandidate =
      "DeepSeek V3 Model Weights Released to Open Source";
    const result = isDuplicateTopic(duplicateCandidate, pastTitles);

    expect(result.isDuplicate).toBe(true);
    expect(result.score).toBeGreaterThan(0.7);
  });

  it("permits novel topics that have not been covered", () => {
    const pastTitles = [
      "DeepSeek V3 Model Weights Released",
      "Meta Introduces Llama 3",
    ];

    const novelCandidate =
      "Mistral Large 2 Demonstrates Exceptional Multilingual Coding";
    const result = isDuplicateTopic(novelCandidate, pastTitles);

    expect(result.isDuplicate).toBe(false);
  });

  describe("Entity Extraction & Cooldown Gates", () => {
    it("extracts recognized tech entities accurately", () => {
      const text = "Jensen Huang announces Nvidia Blackwell Ultra cluster with liquid cooling";
      const entities = extractEntities(text);
      expect(entities).toContain("NVIDIA");
    });

    it("extracts multiple entities when present in comparison articles", () => {
      const text = "Comparing OpenAI o3 reasoning throughput against Google Gemini 2.0 Flash";
      const entities = extractEntities(text);
      expect(entities).toContain("OpenAI");
      expect(entities).toContain("Google");
    });

    it("triggers cooldown when an entity has reached the 2-post limit in 7 days", () => {
      const now = new Date();
      const pastPosts = [
        {
          title: "NVIDIA DGX B200 Architecture Deep Dive",
          createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        },
        {
          title: "Jensen Huang Keynote at Computex Highlights",
          createdAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
        },
      ];

      const cooldown = checkEntityCooldown(["NVIDIA"], pastPosts, 7, 2);
      expect(cooldown.inCooldown).toBe(true);
      expect(cooldown.violatingEntity).toBe("NVIDIA");
      expect(cooldown.postCount).toBe(2);
    });

    it("permits entities with fewer than 2 posts in 7 days", () => {
      const now = new Date();
      const pastPosts = [
        {
          title: "Anthropic Claude 3.7 Sonnet Reasoning Architecture",
          createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        },
      ];

      const cooldown = checkEntityCooldown(["Anthropic"], pastPosts, 7, 2);
      expect(cooldown.inCooldown).toBe(false);
      expect(cooldown.postCount).toBe(0); // Anthropic only has 1, under the 2 threshold
    });

    it("ignores posts older than the cooldown window (e.g. 10 days ago)", () => {
      const now = new Date();
      const pastPosts = [
        {
          title: "NVIDIA Blackwell Benchmark Analysis",
          createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        },
        {
          title: "Jensen Huang AI Summit Remarks",
          createdAt: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000), // 12 days ago
        },
      ];

      const cooldown = checkEntityCooldown(["NVIDIA"], pastPosts, 7, 2);
      expect(cooldown.inCooldown).toBe(false);
    });
  });

  describe("Content Shingle Similarity", () => {
    it("computes accurate 5-gram shingle overlap for identical paragraphs", () => {
      const text =
        "The mixture of experts model activates twenty billion parameters per token with high throughput and low memory footprint.";
      const overlap = computeShingleSimilarity(text, text);
      expect(overlap).toBe(1.0);
    });

    it("flags duplicate content when shingle overlap exceeds 20%", () => {
      const pastSnippet =
        "The mixture of experts model activates twenty billion parameters per token with high throughput and low memory footprint across distributed GPU nodes.";
      const candidateSnippet =
        "The mixture of experts model activates twenty billion parameters per token with high throughput and low memory footprint in production.";

      const check = checkContentSimilarity(candidateSnippet, [pastSnippet], 0.2);
      expect(check.isDuplicate).toBe(true);
      expect(check.score).toBeGreaterThan(0.2);
    });

    it("passes distinct technical paragraphs without flagging", () => {
      const pastSnippet =
        "Quantization down to FP4 precision preserves perplexity benchmarks while halving VRAM requirements.";
      const candidateSnippet =
        "Speculative decoding utilizes a small draft model to generate candidate verification tokens in parallel.";

      const check = checkContentSimilarity(candidateSnippet, [pastSnippet], 0.2);
      expect(check.isDuplicate).toBe(false);
      expect(check.score).toBeLessThan(0.1);
    });
  });
});
