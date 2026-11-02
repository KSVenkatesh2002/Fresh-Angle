import { describe, it, expect } from "vitest";
import { slugify, generateTopicKey } from "@/lib/utils/slug";

describe("slugify", () => {
  it("converts basic text into clean lowercase slug", () => {
    expect(slugify("Claude 3.7 Sonnet Released")).toBe(
      "claude-3-7-sonnet-released",
    );
  });

  it("handles accents, special characters, and multiple spaces", () => {
    expect(slugify("  Café & AI: The Future of Transformers!  ")).toBe(
      "cafe-ai-the-future-of-transformers",
    );
  });

  it("collapses multiple consecutive hyphens", () => {
    expect(slugify("Next.js --- v16 -- Release")).toBe("next-js-v16-release");
  });

  it("handles empty strings gracefully", () => {
    expect(slugify("")).toBe("");
  });
});

describe("generateTopicKey", () => {
  it("removes common stop words and sorts tokens alphabetically", () => {
    const key1 = generateTopicKey("The New Model from DeepSeek");
    const key2 = generateTopicKey("DeepSeek Model New");
    expect(key1).toBe(key2);
  });

  it("ignores short tokens", () => {
    const key = generateTopicKey("AI on a Mac");
    expect(key).toBe("mac");
  });
});
