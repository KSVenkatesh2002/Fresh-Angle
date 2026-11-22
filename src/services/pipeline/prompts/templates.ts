import { PIPELINE_CONFIG } from "@/config/pipeline";

export const SYSTEM_EDITORIAL_PERSONA = `
You are the senior editorial research director and lead systems architect at Fresh Angle (https://freshangle.vercel.app), a premier publication delivering high-authority, deeply analytical dispatches on artificial intelligence, frontier models, and computing infrastructure.

YOUR MISSION:
Deliver comprehensive, original engineering dispatches that synthesize complex breakthroughs from first principles.

CORE EDITORIAL DIRECTIVES:
1. STRICT ANTI-PARAPHRASING MANDATE:
   - NEVER mirror the sequence, structural outline, or paragraph-level narrative of any single source document.
   - NEVER substitute synonyms into source sentences. External plagiarism scanners (Copyleaks, Turnitin, SmallSEOTools) flag structural mirroring as plagiarism.
   - Completely re-conceptualize the subject matter from first principles. Explain the underlying mechanics using your own original frameworks, mental models, and real-world analogies.

2. MULTI-SOURCE SYNTHESIS & INDEPENDENT CRITIQUE:
   - Triangulate findings across all provided sources (primary catalyst, architectural baseline, community critiques).
   - Provide original engineering criticism: Identify unstated trade-offs, hidden latency/memory overheads, hardware bottlenecks, and deployment constraints that the official announcements omit.

3. RIGOROUS FACTUAL GROUNDING WITHOUT COPYING:
   - Ground all empirical metrics, benchmark values, parameters, dates, and proper names strictly in the provided sources. NEVER fabricate numbers or invent synthetic benchmarks.
   - However, the narrative exposition, comparative analysis, and explanatory prose must be 100% original.

4. TARGET AUDIENCE & TONE:
   - Write for Principal ML Engineers, Systems Architects, and Technical Executives.
   - Tone is analytical, precise, lucid, and intellectually rigorous.
   - Eliminate fluff, clickbait, and generic clichés ("game changer", "testament to", "delve into", "in today's rapidly evolving AI landscape").

5. PIPELINE VERSION: ${PIPELINE_CONFIG.promptsVersion}
`;

export function buildOutlinePrompt(topic: string, sourcesText: string): string {
  return `
Create a structured, search-intent-optimized blog post outline for the following topic based on the synthesized sources:

TOPIC: "${topic}"

RESEARCH DOSSIER:
${sourcesText}

ARCHITECTURAL OUTLINE RULES:
1. ANTI-PARAPHRASING: DO NOT mirror the section sequence or table of contents of the source articles.
2. Structure the dispatch to directly answer high-volume developer search queries:
   - Section 1: The Core Breakthrough & System Context (Why previous paradigms failed)
   - Section 2: Architectural Deep Dive & Mechanics (Step-by-step breakdown of internals)
   - Section 3: Empirical Benchmark Matrix (Comparative table against prior baselines)
   - Section 4: Production Realities & Engineering Trade-offs (VRAM, latency, hidden costs, failure modes)
   - Section 5: High-Density Key Takeaways (3-5 architectural bullet points)
   - Section 6: Strategic Roadmap & Deployment Horizon (Next 12-24 months)
3. Output valid JSON matching the schema below.

OUTPUT REQUIREMENTS:
Output a single valid JSON object strictly matching this schema:
{
  "proposedTitle": "Engaging, authoritative title with high search intent (under 80 chars)",
  "thesis": "One-sentence core argument or technical conclusion",
  "targetCategory": "e.g., Artificial Intelligence, Frontier Models & LLMs, Machine Learning, Hardware & Silicon",
  "sections": [
    {
      "heading": "H2 Section Heading (Search-Intent Optimized)",
      "keyPoints": ["Bullet point 1 with original analytical angle", "Bullet point 2"]
    }
  ]
}
`;
}

export function buildDraftPrompt(
  topic: string,
  outlineJson: string,
  sourcesText: string,
): string {
  return `
Write the full technical dispatch in clean, authoritative, publication-ready Markdown based on the approved outline and research dossier.

TOPIC: "${topic}"

OUTLINE:
${outlineJson}

RESEARCH DOSSIER:
${sourcesText}

DEPTH & PLAGIARISM DEFENSE INSTRUCTIONS:
- TARGET LENGTH: 900 to 1,400 words. Provide deep architectural and engineering substance, not a shallow summary.
- ANTI-PARAPHRASING ENFORCEMENT:
  * Plagiarism scanners will cross-reference your output with web sources. Do NOT copy phrases or sentence structures from the sources.
  * Explain the system mechanics from first principles using fresh analogies and your own explanatory breakdowns.
  * Synthesize multiple sources into an integrated analytical narrative.
- MANDATORY CONTENT SECTIONS:
  1. Introduction & Context: What breakthrough or system shift occurred, why existing paradigms fell short, and why this matters now.
  2. System Architecture & Mechanics: Detailed explanation of internal mechanics, data pipelines, model topology (e.g. MoE routing, KV cache, speculative decoding, attention optimizations, or silicon interconnects). Include a clean ASCII or Mermaid diagram where architectural visualization adds clarity.
  3. Benchmark & Performance Comparison Table: MUST include a GitHub-flavored Markdown table comparing key metrics (latency, throughput, MMLU, GSM8K, VRAM, or memory bandwidth) against relevant baselines or prior generations.
  4. Engineering Trade-offs & Production Realities: Practical considerations including deployment costs, hardware requirements, failure modes, and developer ergonomics.
  5. Key Takeaways: High-density bulleted list of 3-5 crucial architectural conclusions.
  6. Industry & Strategic Implications: What this unlocks for autonomous systems, enterprise deployment, or compute infrastructure over the next 12-24 months.
- FACTUAL GROUNDING: Ground all quantitative numbers, benchmark scores, and claims strictly in the sources. Do not invent synthetic metrics.
- FORMAT: Return ONLY the raw Markdown text. Do NOT wrap in JSON.
`;
}

export function buildReviewPrompt(
  topic: string,
  draftMarkdown: string,
  sourcesText: string,
): string {
  return `
Perform a rigorous editorial review of the following technical draft against the research dossier. Correct any unsupported claims, sharpen the technical rigor, verify benchmark comparisons, eliminate conversational fluff, and construct SEO metadata.

CRITICAL REVIEW MANDATES:
1. PLAGIARISM & ORIGINALITY AUDIT:
   - Ensure the draft is NOT a section-by-section paraphrase of any single source.
   - If any paragraph mimics source sentence structure, rewrite it with fresh vocabulary, active voice, and synthesized framing.
2. TECHNICAL RIGOR & BENCHMARK ACCURACY:
   - Verify that all numbers and claims in the Markdown comparison table (| Metric | Model A | Model B | Notes |) match the provided sources.
   - Ensure the "Key Takeaways" section provides high-signal architectural insights.
3. LENGTH & DEPTH: Target length must be 900 to 1,400 words of rich technical depth.
4. METADATA & SEARCH OPTIMIZATION:
   - Construct search-intent-focused title, metaTitle (strictly between 30 and 58 characters), and metaDescription (strictly between 60 and 150 characters).
   - Construct 2 high-value FAQs with factual, helpful answers to capture Google rich snippet SERPs.
   - Create an imaginative, topic-specific image prompt following award-winning art direction guidelines (no text, no distorted faces).

PRIMARY SOURCES:
${sourcesText}

DRAFT POST:
${draftMarkdown}

OUTPUT REQUIREMENTS:
Output a single valid JSON object matching this schema:
{
  "title": "Compelling, punchy headline under 90 characters",
  "excerpt": "Crisp 2-3 sentence overview (under 250 characters)",
  "contentMd": "Complete polished Markdown post (900-1400 words) with Markdown comparison table, architecture breakdown, and Key Takeaways",
  "metaTitle": "Concise SEO title under 55 characters (strictly between 30 and 58 characters)",
  "metaDescription": "Actionable meta description under 150 characters (strictly between 60 and 150 characters)",
  "category": "Artificial Intelligence | Frontier Models & LLMs | Machine Learning | Hardware & Silicon",
  "tags": ["3 to 6 specific lowercase or title-case tags"],
  "slug": "url-friendly-slug-with-hyphens",
  "imagePrompt": "Complete creative freedom: You are an award-winning creative art director. Deliberately choose the visual medium and art style that most meaningfully suits this specific topic (e.g. macro lens engineering photography, clean cutaway diagram, architectural documentary still, high-contrast monochrome editorial portrait, fine-line technical blueprint, warm tactile physical installation, or minimalist vector topology). DO NOT default to generic 3D abstract obsidian blocks or vaults. Describe concrete physical subjects, authentic lighting, framing, and mood directly derived from this post's technical thesis. Strictest negative rule: Strictly NO text, NO words, NO letters, NO typography, NO watermarks, NO logos, NO distorted human faces.",
  "imageAlt": "Descriptive, accessible alt text for the cover image",
  "faq": [
    {
      "question": "Clear, relevant reader question about this development",
      "answer": "Factual 2-3 sentence answer derived from the article"
    },
    {
      "question": "Second relevant question",
      "answer": "Factual 2-3 sentence answer"
    }
  ]
}
`;
}
