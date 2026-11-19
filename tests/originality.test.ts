import { describe, it, expect } from "vitest";
import { checkOriginality } from "@/services/research/originality";

describe("Originality and Source Plagiarism Gate", () => {
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
    expect(result.overlapScore).toBeLessThan(0.15);
  });

  it("fails drafts that copy source phrasing verbatim", () => {
    const copiedPostMd = `
## Introduction

Speculative decoding accelerates autoregressive generation by using an efficient draft model to generate candidate tokens which are verified in parallel by the target model. This paradigm achieves a 2.5x speedup without degrading target model perplexity or sampling distribution fidelity under rigorous multi-GPU benchmarks across standard inference workloads.
`;

    const result = checkOriginality(copiedPostMd, sourceText, 0.15);

    expect(result.passed).toBe(false);
    expect(result.originalityScore).toBeLessThan(80);
    expect(result.overlapScore).toBeGreaterThan(0.15);
    expect(result.matchedExcerpts.length).toBeGreaterThan(0);
  });
});
