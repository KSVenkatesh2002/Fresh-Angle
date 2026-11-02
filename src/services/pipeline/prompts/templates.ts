import { PIPELINE_CONFIG } from '@/config/pipeline';

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
  sourcesText: string
): string {
  return `
Write the full blog post in clean, authoritative Markdown based on the approved outline and sources.

TOPIC: "${topic}"

OUTLINE:
${outlineJson}

SOURCES:
${sourcesText}

WRITING INSTRUCTIONS:
- Tone: Analytical, technical, direct, lucid.
- Structure:
  - Engaging opening introducing the development and its significance.
  - H2 (##) and H3 (###) subheadings mirroring the outline.
  - A dedicated "Key Takeaways" section.
  - Clear explanations of technical trade-offs, architecture, or benchmark numbers (only if present in sources).
  - A thoughtful conclusion on what this means for engineers and the industry.
- Grounding: DO NOT invent numbers or statements. Every factual claim must originate from the provided sources.
- Format: Return ONLY the raw Markdown text. Do NOT wrap in JSON.
`;
}

export function buildReviewPrompt(
  topic: string,
  draftMarkdown: string,
  sourcesText: string
): string {
  return `
Perform a rigorous editorial review of the following draft against the primary sources. Correct any unsupported claims, sharpen the prose, eliminate fluff, and construct SEO metadata.

PRIMARY SOURCES:
${sourcesText}

DRAFT POST:
${draftMarkdown}

OUTPUT REQUIREMENTS:
Output a single valid JSON object matching this schema:
{
  "title": "Compelling, punchy headline under 90 characters",
  "excerpt": "Crisp 2-3 sentence overview (under 250 characters)",
  "contentMd": "Complete polished Markdown post incorporating all edits, sections, and conclusion",
  "metaTitle": "SEO title under 60 characters with high-intent keywords",
  "metaDescription": "Actionable meta description under 155 characters",
  "category": "Artificial Intelligence | Frontier Models & LLMs | Machine Learning | Hardware & Silicon",
  "tags": ["3 to 6 specific lowercase or title-case tags"],
  "slug": "url-friendly-slug-with-hyphens",
  "imagePrompt": "Detailed visual prompt for an editorial cover image depicting this technical concept",
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
