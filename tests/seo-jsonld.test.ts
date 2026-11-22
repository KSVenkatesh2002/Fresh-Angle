import { describe, it, expect } from "vitest";
import { generateArticleJsonLd } from "@/lib/seo/jsonld";
import { siteConfig } from "@/config/site";

describe("SEO Schema.org Rich Snippets (TechArticle)", () => {
  it("generates enriched TechArticle JSON-LD with keywords and word count", () => {
    const jsonLd = generateArticleJsonLd({
      title: "Understanding Speculative Decoding in LLMs",
      description: "A deep dive into speculative drafting algorithms and KV cache verification.",
      slug: "understanding-speculative-decoding-in-llms",
      publishedAt: new Date("2026-11-20T12:00:00Z"),
      categoryName: "Machine Learning",
      wordCount: 1150,
      keywords: ["speculative decoding", "KV cache", "vLLM", "LLM inference"],
    });

    expect(jsonLd["@context"]).toBe("https://schema.org");
    expect(jsonLd["@type"]).toEqual(["TechArticle", "BlogPosting"]);
    expect(jsonLd.headline).toBe("Understanding Speculative Decoding in LLMs");
    expect(jsonLd.inLanguage).toBe("en-US");
    expect(jsonLd.wordCount).toBe(1150);
    expect(jsonLd.keywords).toBe("speculative decoding, KV cache, vLLM, LLM inference");
    expect(jsonLd.articleSection).toBe("Machine Learning");
  });

  it("verifies indexNowKey configuration fallback exists and is 32-character hex string", () => {
    expect(siteConfig.indexNowKey).toBeDefined();
    expect(siteConfig.indexNowKey.length).toBe(32);
    expect(/^[a-f0-9]{32}$/i.test(siteConfig.indexNowKey)).toBe(true);
  });
});

