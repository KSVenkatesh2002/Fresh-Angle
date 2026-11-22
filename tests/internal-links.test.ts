import { describe, it, expect } from "vitest";
import {
  extractTargetKeywords,
  injectContextualInternalLinks,
  LinkTarget,
} from "@/services/seo/internal-links";

describe("Contextual Internal Linking Engine", () => {
  it("extracts meaningful target keywords from post title and tags", () => {
    const title = "Fine-Tuning LLMs with Speculative Decoding on AMD GPUs";
    const tags = ["speculative-decoding", "vllm", "amd-rocm"];

    const keywords = extractTargetKeywords(title, tags);

    expect(keywords).toContain("AMD");
    expect(keywords).toContain("speculative decoding");
    expect(keywords).toContain("amd rocm");
    // Verify sorted by length descending
    for (let i = 0; i < keywords.length - 1; i++) {
      expect(keywords[i].length).toBeGreaterThanOrEqual(keywords[i + 1].length);
    }
  });

  it("injects internal links into markdown paragraphs without touching headings or code", () => {
    const postMd = `
# System Architecture

In modern production setups, speculative decoding allows engineers to dramatically accelerate LLM inference throughput.

\`\`\`python
# This speculative decoding code must not be altered
model = load_model("speculative-model")
\`\`\`

| Feature | Speculative Decoding | Autoregressive Baseline |
| :--- | :--- | :--- |
| Latency | Low | High |

Developers leveraging Anthropic Claude models often report substantial cost savings.
`;

    const targets: LinkTarget[] = [
      {
        id: "target-1",
        title: "Complete Guide to Speculative Decoding",
        slug: "complete-guide-speculative-decoding",
        keywords: ["speculative decoding"],
      },
      {
        id: "target-2",
        title: "Anthropic Claude 3.7 Architecture",
        slug: "anthropic-claude-3-7-architecture",
        keywords: ["Anthropic Claude", "Claude"],
      },
    ];

    const result = injectContextualInternalLinks(postMd, "current-post", targets, 3);

    expect(result.injectedLinks.length).toBe(2);
    expect(result.injectedLinks[0].targetSlug).toBe("complete-guide-speculative-decoding");
    expect(result.injectedLinks[1].targetSlug).toBe("anthropic-claude-3-7-architecture");

    // Paragraph should have the link
    expect(result.enrichedMd).toContain(
      "[speculative decoding](/blog/complete-guide-speculative-decoding)",
    );
    expect(result.enrichedMd).toContain(
      "[Anthropic Claude](/blog/anthropic-claude-3-7-architecture)",
    );

    // Code block and table must remain unmodified
    expect(result.enrichedMd).toContain(
      '# This speculative decoding code must not be altered',
    );
    expect(result.enrichedMd).toContain(
      '| Feature | Speculative Decoding | Autoregressive Baseline |',
    );
  });

  it("prevents self-linking back to the same article", () => {
    const postMd = `Here is an article about deep learning optimization and speculative decoding.`;
    const targets: LinkTarget[] = [
      {
        id: "self-target",
        title: "Speculative Decoding",
        slug: "speculative-decoding-article",
        keywords: ["speculative decoding"],
      },
    ];

    const result = injectContextualInternalLinks(
      postMd,
      "speculative-decoding-article", // Same slug as target
      targets,
      3,
    );

    expect(result.injectedLinks.length).toBe(0);
    expect(result.enrichedMd).toBe(postMd);
  });

  it("respects maxLinks constraint", () => {
    const postMd = `Paragraph discussing speculative decoding, Claude models, and Nvidia hardware.`;
    const targets: LinkTarget[] = [
      { id: "1", title: "SD", slug: "sd", keywords: ["speculative decoding"] },
      { id: "2", title: "Claude", slug: "claude", keywords: ["Claude"] },
      { id: "3", title: "Nvidia", slug: "nvidia", keywords: ["Nvidia"] },
    ];

    const result = injectContextualInternalLinks(postMd, "other", targets, 1);
    expect(result.injectedLinks.length).toBe(1);
  });
});
