import { describe, it, expect } from "vitest";
import { checkOriginality } from "@/services/research/originality";
import { capRepeatedUrlLinks, analyzeCitations } from "@/services/research/sources";

describe("Multi-Granularity Originality and Plagiarism Defense Gate (Phase 3)", () => {
  const multiSourceText = `
[SOURCE 1: Primary Paper]
TITLE: Speculative Decoding with Draft Verification in Multi-GPU Clusters
URL: https://arxiv.org/abs/2401.00001
CONTENT: Speculative decoding accelerates autoregressive generation by using an efficient draft model to generate candidate tokens which are verified in parallel by the target model. This paradigm achieves a 2.5x speedup without degrading target model perplexity or sampling distribution fidelity under rigorous multi-GPU benchmarks across standard inference workloads.

[SOURCE 2: Baseline Benchmark Docs]
TITLE: Distributed Serving Benchmarks
URL: https://vllm.ai/docs/benchmarks
CONTENT: Standard autoregressive decoding is fundamentally memory bandwidth bound on modern GPU architectures like NVIDIA H100 SXM5 with 3.35 TB/s throughput. Pipeline parallelism introduces inter-node communication latency during KV cache synchronization.

[SOURCE 3: Practitioner Commentary]
TITLE: Community Retrospective
URL: https://news.ycombinator.com/item?id=123456
CONTENT: Production teams report that while speculative decoding reduces time-to-first-token in synthetic benchmarks, batch size saturation in multi-tenant environments diminishes effective speedup to 1.3x due to draft model queuing overhead.
`;

  it("passes highly original synthesis with multi-source triangulation and low overlap", () => {
    const originalPostMd = `
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

    const result = checkOriginality(originalPostMd, multiSourceText);

    expect(result.passed).toBe(true);
    expect(result.originalityScore).toBeGreaterThanOrEqual(85);
    expect(result.overlap3Gram).toBeLessThan(0.05);
    expect(result.overlap4Gram).toBeLessThan(0.02);
    expect(result.overlap5Gram).toBeLessThan(0.01);
    expect(result.maxConsecutiveWordsRun).toBeLessThanOrEqual(8);
    expect(result.flaggedSentences.length).toBe(0);
  });

  it("fails drafts that copy source phrasing verbatim across multiple sources", () => {
    const copiedPostMd = `
## Introduction

Speculative decoding accelerates autoregressive generation by using an efficient draft model to generate candidate tokens which are verified in parallel by the target model. This paradigm achieves a 2.5x speedup without degrading target model perplexity or sampling distribution fidelity under rigorous multi-GPU benchmarks across standard inference workloads.

Standard autoregressive decoding is fundamentally memory bandwidth bound on modern GPU architectures like NVIDIA H100 SXM5 with 3.35 TB/s throughput.
`;

    const result = checkOriginality(copiedPostMd, multiSourceText);

    expect(result.passed).toBe(false);
    expect(result.originalityScore).toBeLessThan(80);
    expect(result.overlap5Gram).toBeGreaterThan(0.01);
    expect(result.maxConsecutiveWordsRun).toBeGreaterThan(8);
    expect(result.flaggedSentences.length).toBeGreaterThan(0);
  });

  it("detects and flags sentence-level semantic similarity above 50% on long sentences", () => {
    // Paraphrased sentence that substitutes words but retains structure and > 50% content words
    const paraphrasedMd = `
## System Review

Speculative decoding speeds up autoregressive generation by employing an efficient draft model to produce candidate tokens which are confirmed in parallel by the target model.
`;

    const result = checkOriginality(paraphrasedMd, multiSourceText);

    expect(result.flaggedSentences.length).toBeGreaterThan(0);
    expect(result.flaggedSentences[0].similarity).toBeGreaterThanOrEqual(0.50);
  });

  it("avoids false positives on short sentences under 8 words", () => {
    const shortSentencesMd = `
## Overview
We evaluate the framework.
This achieves high throughput.
Memory bandwidth is constrained.
Results confirm linear scaling.
`;

    const result = checkOriginality(shortSentencesMd, multiSourceText);
    expect(result.flaggedSentences.length).toBe(0);
  });

  it("allows up to 2 attributed direct quotes under 15 words and exempts them from run check", () => {
    const postWithAllowedQuote = `
## Architectural Evaluation

According to the research team, "speculative decoding accelerates autoregressive generation" through parallelized drafting stages.
Independent evaluators noted that "batch size saturation diminishes effective speedup" in heterogeneous environments.
`;

    const result = checkOriginality(postWithAllowedQuote, multiSourceText);
    expect(result.quoteCount).toBe(2);
    expect(result.quotes.every((q) => q.isUnderLimit)).toBe(true);
    // Even though the quote itself is 6 words from source, it is marked as quote and does not cause a run failure
    expect(result.reasons.some((r) => r.includes("Longest consecutive matching words"))).toBe(false);
  });

  it("flags direct quotes that exceed 14 words", () => {
    const postWithOverlongQuote = `
According to the original benchmark publication, "speculative decoding accelerates autoregressive generation by using an efficient draft model to generate candidate tokens which are verified in parallel by the target model" under production workloads.
`;

    const result = checkOriginality(postWithOverlongQuote, multiSourceText);
    expect(result.reasons.some((r) => r.includes("Direct quote exceeds length limit"))).toBe(true);
  });

  it("ignores code blocks, markdown tables, blockquotes, and headers", () => {
    const postWithCodeAndTable = `
# Deep Systems Analysis

> Speculative decoding accelerates autoregressive generation by using an efficient draft model to generate candidate tokens which are verified in parallel by the target model.

\`\`\`python
# Speculative decoding accelerates autoregressive generation by using an efficient draft model
def run_benchmark():
    return "Standard autoregressive decoding is fundamentally memory bandwidth bound on modern GPU architectures"
\`\`\`

| Source Metric | Autoregressive decoding is fundamentally memory bandwidth bound |
| :--- | :--- |
| Peak Bandwidth | 3.35 TB/s |

Here is completely genuine original technical prose analyzing GPU scheduling heuristics and memory eviction policies across independent nodes.
`;

    const result = checkOriginality(postWithCodeAndTable, multiSourceText);
    expect(result.overlap5Gram).toBe(0);
    expect(result.maxConsecutiveWordsRun).toBeLessThanOrEqual(8);
  });

  it("enforces mathematical invariant: maxRun >= 3 implies 3-gram overlap > 0", () => {
    const postMd = `
## Architectural Paradigm Shift
Speculative decoding accelerates autoregressive generation by using an efficient draft model to generate candidate tokens which are verified in parallel.
`;
    const result = checkOriginality(postMd, multiSourceText);
    expect(result.overlap3Gram).toBeGreaterThan(0);
  });

  it("caps repeated links to the same destination URL at max 2 occurrences", () => {
    const textWithExcessiveLinks = `
According to [Anthropic](https://anthropic.com/research), modern reasoning systems scale well.
Further reported by [Anthropic Team](https://anthropic.com/research), throughput reaches high limits.
In fact, [Anthropic Whitepaper](https://anthropic.com/research) confirms the 2.5x gain.
Finally, [Anthropic Direct](https://anthropic.com/research) summarizes the architectural horizon.
Another link to [Google](https://google.com) is unique.
`;
    const cleaned = capRepeatedUrlLinks(textWithExcessiveLinks, 2);
    const analysis = analyzeCitations(cleaned);

    expect(analysis.linksPerUrl["https://anthropic.com/research"]).toBe(2);
    expect(analysis.linksPerUrl["https://google.com"]).toBe(1);
    expect(cleaned).toContain("[Anthropic](https://anthropic.com/research)");
    expect(cleaned).toContain("[Anthropic Team](https://anthropic.com/research)");
    expect(cleaned).not.toContain("[Anthropic Whitepaper](https://anthropic.com/research)");
    expect(cleaned).toContain("Anthropic Whitepaper confirms the 2.5x gain.");
  });
});
