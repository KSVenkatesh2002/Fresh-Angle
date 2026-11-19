import { describe, it, expect, vi } from "vitest";
import {
  scoreSubstance,
  scoreFreshness,
  scoreAuthority,
  scoreDiversity,
  selectBestTopicCandidate,
} from "@/services/research/topic-selector";
import { TopicCandidate } from "@/services/research/topics";

// Mock external HTTP extraction to avoid live network calls during unit test
vi.mock("@/services/research/sources", () => ({
  extractArticleContent: vi.fn().mockImplementation(async (url: string, title?: string) => ({
    url,
    title: title || "Test Article",
    publisher: "Test Publisher",
    content: "This is a detailed technical architecture post with over three hundred words explaining the transformer benchmarks, throughput latency evaluations, and quantized inference memory bandwidth metrics across modern distributed hardware clusters in production environments. ".repeat(15),
  })),
}));

describe("Topic Selector & Multi-Factor Scoring", () => {
  it("rewards deep technical substance over hype/financial rumors", () => {
    const technical = "Mixture of Experts architecture throughput benchmark and quantized inference evaluation";
    const rumor = "Company shares jump on stock valuation rumors amidst billionaire controversy";

    const techScore = scoreSubstance(technical);
    const rumorScore = scoreSubstance(rumor);

    expect(techScore).toBeGreaterThan(0.7);
    expect(rumorScore).toBeLessThan(0.4);
    expect(techScore).toBeGreaterThan(rumorScore);
  });

  it("scores freshness progressively based on publication age", () => {
    const now = new Date();
    const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString();
    const threeDaysAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString();

    const freshScore = scoreFreshness(fourHoursAgo);
    const olderScore = scoreFreshness(threeDaysAgo);

    expect(freshScore).toBe(1.0);
    expect(olderScore).toBeLessThan(freshScore);
  });

  it("prioritizes research authority feeds like ArXiv and DeepMind", () => {
    const arxiv = scoreAuthority("ArXiv Computer Science AI");
    const techcrunch = scoreAuthority("TechCrunch AI");

    expect(arxiv).toBe(1.0);
    expect(arxiv).toBeGreaterThan(techcrunch);
  });

  it("applies diversity penalty when consecutive categories are duplicated", () => {
    const recentPosts = [
      {
        title: "Deep Learning Memory Bandwidth",
        createdAt: new Date(),
        topicKey: "dl-1",
        category: "AI Research",
      },
      {
        title: "Transformer Latency Optimizations",
        createdAt: new Date(),
        topicKey: "dl-2",
        category: "AI Research",
      },
    ];

    const duplicateCatScore = scoreDiversity("AI Research", [], recentPosts);
    const novelCatScore = scoreDiversity("Semiconductors & Hardware", [], recentPosts);

    expect(duplicateCatScore).toBeLessThan(novelCatScore);
  });

  it("automatically cools down repeated entities and selects alternative candidate", async () => {
    const now = new Date();
    const pastPosts = [
      {
        title: "NVIDIA DGX B200 Supercomputer Analysis",
        topicKey: "nvidia-1",
        createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
        category: "Semiconductors & Hardware",
      },
      {
        title: "Jensen Huang Computex Keynote Breakthroughs",
        topicKey: "nvidia-2",
        createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        category: "Semiconductors & Hardware",
      },
    ];

    const candidates: TopicCandidate[] = [
      {
        title: "NVIDIA Announces New Blackwell Ultra Chip Revision",
        url: "https://example.com/nvidia-blackwell-ultra",
        sourceFeed: "TechCrunch AI",
        category: "Semiconductors & Hardware",
        pubDate: now.toISOString(),
        relevanceScore: 95,
      },
      {
        title: "ArXiv: DeepSeek V3 Architecture and Training Infrastructure Details",
        url: "https://example.com/deepseek-v3-paper",
        sourceFeed: "ArXiv Computer Science AI",
        category: "AI Research",
        pubDate: now.toISOString(),
        relevanceScore: 90,
      },
    ];

    const result = await selectBestTopicCandidate(candidates, pastPosts);

    // NVIDIA is in cooldown (2 posts in 3 days) -> DeepSeek MUST be selected!
    expect(result.selectedTopic.title).toContain("DeepSeek");
    expect(result.evaluation.entities).toContain("DeepSeek");
  });
});

