import { describe, it, expect } from "vitest";
import { evaluateQualityGates } from "../src/services/seo/quality-gates";

describe("Content Quality Gates Evaluation", () => {
  it("fails posts with insufficient word count", () => {
    const result = evaluateQualityGates({
      title: "Short Article on Robotics",
      excerpt: "A short article description that is brief.",
      contentMd:
        "## Heading 1\n\nShort content with only a few words.\n\n## Heading 2\n\nMore words.\n\n## Heading 3\n\nKey Takeaways here.",
      sourcesCount: 2,
    });

    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.includes("Word count too low"))).toBe(
      true,
    );
  });

  it("detects banned filler phrases and penalizes score", () => {
    // Generate 750 words of body content
    const baseWords = new Array(750).fill("technical").join(" ");
    const content = `## Architecture Overview\n\n${baseWords}\n\nIn today's fast-paced world, models scale.\n\n## Benchmark Performance\n\nData here.\n\n## Key Takeaways\n\nSummary points.`;

    const result = evaluateQualityGates({
      title: "Anthropic Introduces Hybrid Reasoning Architecture",
      excerpt:
        "Comprehensive architectural breakdown of hybrid reasoning techniques and latency trade-offs.",
      contentMd: content,
      sourcesCount: 2,
    });

    expect(result.issues.some((i) => i.includes("Banned filler phrase"))).toBe(
      true,
    );
  });

  it("passes comprehensive technical briefing meeting all criteria", () => {
    const section1 = new Array(300).fill("transformer").join(" ");
    const section2 = new Array(300).fill("attention").join(" ");
    const section3 = new Array(200).fill("quantization").join(" ");

    const markdown = [
      "## Architectural Foundations",
      section1,
      "## Empirical Benchmark Results",
      section2,
      "## Key Takeaways and Implications",
      section3,
    ].join("\n\n");

    const result = evaluateQualityGates({
      title: "Anthropic Introduces Claude 3.7 Sonnet with Reasoning",
      excerpt:
        "Comprehensive architectural breakdown of hybrid reasoning techniques, latency trade-offs, and inference costs.",
      contentMd: markdown,
      sourcesCount: 3,
    });

    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.issues).toHaveLength(0);
  });
});
