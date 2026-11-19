import { PIPELINE_CONFIG } from "@/config/pipeline";

export const SYSTEM_EDITORIAL_PERSONA = `
You are the senior editorial research director at Fresh Angle (https://freshangle.vercel.app), a high-authority publication focusing on artificial intelligence and emerging technology.
Your core principles:
1. STRICT TRUTHFULNESS: Only use facts, metrics, and quotes present in the provided sources. NEVER hallucinate benchmarks, quotes, dates, or URLs.
2. SYNTHESIS: Synthesize information in your own original words. Do not copy or paraphrase verbatim.
3. DEPTH & CLARITY: Write for software engineers, ML researchers, and tech leaders. Avoid corporate buzzwords and marketing fluff.
4. VERSION: ${PIPELINE_CONFIG.promptsVersion}
`;

export function buildOutlinePrompt(topic: string, sourcesText: string): string {
  return `
Create a structured blog post outline for the following topic based strictly on the provided sources:

TOPIC: "${topic}"

RESEARCH SOURCES:
${sourcesText}

OUTPUT REQUIREMENTS:
Output a single valid JSON object strictly matching this schema:
{
  "proposedTitle": "Engaging, authoritative title (under 80 chars)",
  "thesis": "One-sentence core argument or key takeaway",
  "targetCategory": "e.g., Artificial Intelligence, Frontier Models & LLMs, Machine Learning, Hardware & Silicon",
  "sections": [
    {
      "heading": "H2 Section Heading",
      "keyPoints": ["Bullet point 1 based on source facts", "Bullet point 2"]
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
Write the full technical dispatch in clean, authoritative, publication-ready Markdown based on the approved outline and sources.

TOPIC: "${topic}"

OUTLINE:
${outlineJson}

SOURCES:
${sourcesText}

DEPTH & TECHNICAL RIGOR INSTRUCTIONS:
- TARGET LENGTH: 900 to 1,400 words. Provide deep architectural and engineering substance, not a shallow summary.
- TONE: Authoritative, engineering-focused, analytical, lucid. Write for staff ML engineers, distributed systems architects, and technical leaders.
- MANDATORY CONTENT SECTIONS:
  1. Introduction & Context: What breakthrough or system shift occurred, why existing paradigms fell short, and why this matters now.
  2. System Architecture & Mechanics: Detailed explanation of internal mechanics, data pipelines, model topology (e.g. MoE routing, KV cache, speculative decoding, attention optimizations, or silicon interconnects).
  3. Benchmark & Performance Comparison Table: MUST include a GitHub-flavored Markdown table comparing key metrics (latency, throughput, MMLU, GSM8K, VRAM, or memory bandwidth) against relevant baselines or prior generations.
  4. Engineering Trade-offs & Production Realities: Practical considerations including deployment costs, hardware requirements, failure modes, and developer ergonomics.
  5. Key Takeaways: High-density bulleted list of 3-5 crucial architectural conclusions.
  6. Industry & Strategic Implications: What this unlocks for autonomous systems, enterprise deployment, or compute infrastructure over the next 12-24 months.
- ORIGINALITY & SYNTHESIS: Synthesize all information in your own completely original words. Do not copy phrasing or sentence structures from the sources.
- GROUNDING: Ground all quantitative numbers, benchmark scores, and claims strictly in the sources. Do not invent synthetic metrics.
- FORMAT: Return ONLY the raw Markdown text. Do NOT wrap in JSON.
`;
}

export function buildReviewPrompt(
  topic: string,
  draftMarkdown: string,
  sourcesText: string,
): string {
  return `
Perform a rigorous editorial review of the following technical draft against the primary sources. Correct any unsupported claims, sharpen the technical rigor, verify benchmark comparisons, eliminate conversational fluff, and construct SEO metadata.

PRIMARY SOURCES:
${sourcesText}

DRAFT POST:
${draftMarkdown}

EDITORIAL CRITERIA:
1. Target length must be 900 to 1,400 words of rich technical depth.
2. Ensure there is a Markdown comparison table (| Metric | Model A | Model B | Notes |) and a dedicated "Key Takeaways" section.
3. Originality: Verify that the draft synthesizes concepts in fresh editorial language rather than copying source phrasing verbatim.
4. Eliminate corporate clichés ("game changer", "delve into", "testament to", "in today's fast-paced world").

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
