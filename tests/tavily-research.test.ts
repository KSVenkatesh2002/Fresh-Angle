import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  TavilyClient,
  extractSearchKeywords,
  getHostname,
  gatherMultiSourceResearch,
} from "@/services/research/tavily";

describe("Tavily Multi-Source Research Engine", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("TavilyClient Limits & Availability", () => {
    it("reports availability based on valid API key format", () => {
      const clientWithKey = new TavilyClient("tvly-testkey123");
      expect(clientWithKey.isAvailable()).toBe(true);

      const clientWithoutKey = new TavilyClient("");
      expect(clientWithoutKey.isAvailable()).toBe(false);

      const clientWithInvalidKey = new TavilyClient("sk-invalidkey");
      expect(clientWithInvalidKey.isAvailable()).toBe(false);
    });

    it("enforces maximum 3 queries per article and rejects excess queries", async () => {
      const client = new TavilyClient("tvly-mock-key");

      // Mock fetch returning fresh Response instance per call
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
        new Response(
          JSON.stringify({
            results: [
              {
                title: "Doc 1",
                url: "https://docs.example.com/item",
                content: "Documentation text content",
                score: 0.9,
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

      // Perform 3 queries
      await client.search("query 1");
      await client.search("query 2");
      await client.search("query 3");
      expect(client.getQueryCount()).toBe(3);

      // 4th query should be blocked by per-article rate guard
      const excessResult = await client.search("query 4");
      expect(excessResult).toEqual([]);
      expect(fetchSpy).toHaveBeenCalledTimes(3);

      // Reset works
      client.resetQueryCount();
      expect(client.getQueryCount()).toBe(0);
    });

    it("handles HTTP errors gracefully and returns empty array", async () => {
      const client = new TavilyClient("tvly-mock-key");
      vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
        new Response("Unauthorized", { status: 401 }),
      );

      const results = await client.search("query error");
      expect(results).toEqual([]);
    });
  });

  describe("Domain & Keyword Utilities", () => {
    it("extracts high-signal technical keywords and filters stop words", () => {
      const keywords = extractSearchKeywords(
        "Introducing DeepSeek-V3: A New Open Architecture with Multi-Head Latent Attention",
      );
      expect(keywords).toBe("DeepSeek-V3 Open Architecture Multi-Head");
    });

    it("extracts and normalizes clean hostnames for domain deduplication", () => {
      expect(getHostname("https://www.nature.com/articles/d41586-024-001")).toBe(
        "nature.com",
      );
      expect(getHostname("http://docs.anthropic.com/en/docs/overview")).toBe(
        "docs.anthropic.com",
      );
      expect(getHostname("invalid-url")).toBe("");
    });
  });

  describe("gatherMultiSourceResearch Fallback & Triangulation", () => {
    it("falls back gracefully to research_depth='single' when no secondary sources are found", async () => {
      // Mock fetch returning empty results for search and APIs
      vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
        new Response(
          JSON.stringify({ results: [], hits: [] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

      const emptyResult = await gatherMultiSourceResearch(
        "Unknown Rare Niche Topic 12345",
        "https://primary.example.com/announcement",
      );

      expect(emptyResult.researchDepth).toBe("single");
      expect(emptyResult.allSources).toEqual([]);
    });

    it("deduplicates secondary sources sharing the primary domain", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
        new Response(
          JSON.stringify({
            results: [
              {
                title: "Primary Domain Duplicate",
                url: "https://techcrunch.com/another-article",
                content: "Content from same domain that must be skipped",
                score: 0.95,
              },
              {
                title: "Unique Third-Party Source",
                url: "https://semianalysis.com/deep-dive",
                content:
                  "Comprehensive architecture breakdown and cost modeling benchmarks.",
                score: 0.88,
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

      const res = await gatherMultiSourceResearch(
        "Nvidia Blackwell Architecture Analysis",
        "https://techcrunch.com/2026/01/01/nvidia-blackwell",
      );

      // Should not contain techcrunch.com as secondary source
      for (const s of res.allSources) {
        expect(getHostname(s.url)).not.toBe("techcrunch.com");
      }
    });
  });
});
