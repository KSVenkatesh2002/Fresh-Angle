import { describe, it, expect } from "vitest";
import { checkOriginality } from "@/services/research/originality";

describe("Multi-Granularity Originality and Plagiarism Defense Gate", () => {
  const sourceText = `
[Source 1: Research Paper]
Title: Speculative Decoding with Draft Verification in Multi-GPU Clusters
URL: https://arxiv.org/abs/2401.00001
Content: Speculative decoding accelerates autoregressive generation by using an efficient draft model to generate candidate tokens which are verified in parallel by the target model. This paradigm achieves a 2.5x speedup without degrading target model perplexity or sampling distribution fidelity under rigorous multi-GPU benchmarks across standard inference workloads.
`;

  it("passes highly original synthesis with low source overlap", () => {
    const postMd = `
## Architectural Paradigm Shift

In modern distributed LLM serving systems, memory bandwidth represents the primary performance bottleneck rather than compute floating point operations. To alleviate this constraint, speculative drafting approaches partition token generation across heterogeneous model tiers. By delegating preliminary token sequences to a lightweight secondary neural network, high-tier target architectures can execute batched parallel verifications during a single memory load cycle.

| Metric | Baseline Autoregressive | Speculative Parallel Pipeline | Improvement |
| :--- | :--- | :--- | :--- |
| Latency Per Token | 32ms | 13ms | 2.46x Reduction |
| VRAM Bandwidth Saturation | 94% | 41% | 56% Headroom |

## Key Takeaways
- Decouples token creation from high-cost target weights.
- Preserves exact mathematical perplexity without quantization error.
`;

    const result = checkOriginality(postMd, sourceText);

    expect(result.passed).toBe(true);
    expect(result.originalityScore).toBeGreaterThanOrEqual(85);
    expect(result.overlap3Gram).toBeLessThan(0.12);
    expect(result.overlap5Gram).toBeLessThan(0.05);
    expect(result.flaggedSentences.length).toBe(0);
  });

  it("fails drafts that copy source phrasing verbatim", () => {
    const copiedPostMd = `
## Introduction

Speculative decoding accelerates autoregressive generation by using an efficient draft model to generate candidate tokens which are verified in parallel by the target model. This paradigm achieves a 2.5x speedup without degrading target model perplexity or sampling distribution fidelity under rigorous multi-GPU benchmarks across standard inference workloads.
`;

    const result = checkOriginality(copiedPostMd, sourceText, 0.05);

    expect(result.passed).toBe(false);
    expect(result.originalityScore).toBeLessThan(80);
    expect(result.overlap5Gram).toBeGreaterThan(0.05);
    expect(result.matchedExcerpts.length).toBeGreaterThan(0);
    expect(result.flaggedSentences.length).toBeGreaterThan(0);
  });

  it("detects and flags sentence-level semantic similarity above 50%", () => {
    // Paraphrased sentence that substitutes a couple of words but retains 70%+ identical tokens
    const paraphrasedMd = `
## System Review

Speculative decoding speeds up autoregressive generation by employing an efficient draft model to produce candidate tokens which are confirmed in parallel by the target model. Furthermore, memory architectures require careful pipeline scheduling.
`;

    const result = checkOriginality(paraphrasedMd, sourceText, {
      maxSentenceSimilarity: 0.50,
    });

    expect(result.flaggedSentences.length).toBeGreaterThan(0);
    expect(result.flaggedSentences[0].similarity).toBeGreaterThanOrEqual(0.50);
    expect(result.reasons.some((r) => r.includes("similarity"))).toBe(true);
  });

  it("ignores code blocks, markdown tables, and headers during shingle analysis", () => {
    const postWithCodeAndTable = `
# Deep Systems Analysis

\`\`\`python
# This code block might contain source words like speculative decoding autoregressive
def test():
    return "Speculative decoding accelerates autoregressive generation by using an efficient draft model"
\`\`\`

Here is our completely distinct architectural overview focused on GPU cache eviction policies and kernel fusing.
`;

    const result = checkOriginality(postWithCodeAndTable, sourceText);
    expect(result.overlap5Gram).toBe(0);
  });
});
