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
    const section1 = new Array(350).fill("transformer").join(" ");
    const section2 = new Array(350).fill("attention").join(" ");
    const section3 = new Array(250).fill("quantization").join(" ");

    const benchmarkTable = [
      "| Benchmark Metric | Prior Generation | New Architecture | Delta |",
      "| :--- | :--- | :--- | :--- |",
      "| Throughput (tok/s) | 42 | 118 | +180% |",
      "| MMLU-Pro Accuracy | 68.4% | 79.2% | +10.8% |",
      "| Memory Footprint (VRAM) | 48GB | 24GB | -50% |",
    ].join("\n");

    const markdown = [
      "## Architectural Foundations and Data Pipelines",
      section1,
      "## Empirical Benchmark Results and Performance Comparison",
      benchmarkTable,
      section2,
      "## Key Takeaways and Engineering Trade-offs",
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

  it("penalizes missing benchmark comparison tables", () => {
    const section = new Array(900).fill("architecture").join(" ");
    const markdown = [
      "## Architecture Overview",
      section,
      "## Key Takeaways",
      "Key takeaways list here.",
    ].join("\n\n");

    const result = evaluateQualityGates({
      title: "Deep Technical Exploration of Foundation Models",
      excerpt: "Deep technical exploration of foundation models and distributed memory architectures.",
      contentMd: markdown,
      sourcesCount: 2,
    });

    expect(result.issues.some((i) => i.includes("Missing benchmark or metrics comparison table"))).toBe(true);
  });
});
