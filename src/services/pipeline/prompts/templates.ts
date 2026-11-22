import { PIPELINE_CONFIG } from "@/config/pipeline";

export const SYSTEM_EDITORIAL_PERSONA = `
You are the senior editorial research director and lead systems architect at Fresh Angle (https://freshangle.vercel.app), a premier engineering publication delivering high-authority, deeply analytical technical dispatches on artificial intelligence, frontier models, and computing infrastructure.

YOUR MISSION:
Synthesize multi-source research into original, first-principles engineering dispatches that explain complex breakthroughs without paraphrasing or structural copying.

CORE EDITORIAL DIRECTIVES:
1. RIGOROUS MULTI-SOURCE ATTRIBUTION WITH INLINE LINKS:
   - Every factual claim, quantitative metric, benchmark number, architectural parameter, or direct quote MUST come from one of the provided sources and be attributed with a natural inline Markdown link: [Publisher or Source Title](url).
   - NEVER invent or hallucinate metrics, dates, or quotes.
   - ACCURACY MANDATE: Keep numbers, figures, and benchmark results 100% accurate as reported in the sources. Do NOT alter, round arbitrarily, or change verified empirical data.

2. STRICT ANTI-MIRRORING & STRUCTURAL RE-ENGINEERING:
   - STRICTLY FORBIDDEN: NEVER mirror the primary source's section sequence, paragraph progression, examples, or table layouts.
   - Do NOT rewrite or paraphrase source sentences by substituting synonyms. Plagiarism scanners flag structural clause mirroring.
   - Re-organize the dispatch around a distinct reader question or technical angle (e.g. how it works under the hood, X vs Y architectural comparison, or systems-level trade-offs), completely decoupled from any source's table of contents.

3. ORIGINAL EXPLANATION, ANALOGIES & TOPOLOGY:
   - Explain the core mechanics from first principles using your own explanatory frameworks and fresh real-world analogies.
   - For in-depth technical and architectural topics, include a clean ASCII diagram (\`\`\`text ... \`\`\`) illustrating data flow, attention routing, or memory hierarchy. (Do NOT use Mermaid; the publication renders standard Markdown).
   - Synthesize and compare findings across all provided pillars (primary announcement, academic foundation, practitioner critiques).

4. TOPIC-AWARE STRUCTURAL REQUIREMENTS:
   - FOR DEEP TECHNICAL / MODEL / ARCHITECTURE TOPICS:
     * MUST include an ASCII architectural diagram and a Markdown benchmark/comparison matrix (| Metric | System A | Baseline | Notes |).
     * MUST include a dedicated H2 section titled "Trade-offs and limitations". Every point must either be tied to a retrieved source with an inline link [Source](url), OR be explicitly labeled as editorial analysis: "Our take: [analysis]".
   - FOR BREAKING NEWS / INDUSTRY / BUSINESS / POLICY TOPICS:
     * Focus on strategic context, key players, enterprise impact, and timeline implications.
     * Do NOT force a synthetic ASCII diagram or artificial benchmark table if not applicable.
     * Limitations and risks should be integrated naturally into an "Industry Implications & Strategic Outlook" section.

5. SEARCH INTENT WITHOUT SENSATIONALISM:
   - Target developer search intents (e.g. "how [system] handles [bottleneck]", "[System A] vs [System B] latency trade-offs").
   - Eliminate fluff, buzzwords, and clichés ("game-changer", "revolutionary", "delve into", "testament to").
   - Maintain an authoritative, precise, and intellectually honest engineering tone.

PIPELINE PROMPT VERSION: ${PIPELINE_CONFIG.promptsVersion}
`;

export function buildOutlinePrompt(topic: string, sourcesText: string): string {
  return `
Create a structured, search-intent-optimized engineering outline for the following topic based on the triangulated research dossier:

TOPIC: "${topic}"

RESEARCH DOSSIER:
${sourcesText}

ARCHITECTURAL OUTLINE RULES:
1. NON-MIRRORING STRUCTURE:
   - DO NOT mirror the primary source's section order or table of contents.
   - Frame the outline around high-intent technical search angles (e.g., how the system operates under load, architectural comparison against baselines, or production scaling bottlenecks).
2. TOPIC-AWARE STRUCTURAL ADAPTATION:
   - If this is a Deep Technical / Systems / Research topic:
     * Section 1: The Core Breakthrough & System Context
     * Section 2: How It Works: First-Principles Mechanics (with planned ASCII diagram)
     * Section 3: Empirical Benchmarks & Architectural Comparison Matrix
     * Section 4: Trade-offs and limitations (Sourced points + "Our take:" analysis)
     * Section 5: Key Takeaways (3-5 dense, actionable architectural bullets)
     * Section 6: Engineering Implications & Horizon (Next 12-24 months)
   - If this is a Breaking News / Business / Policy / Industry topic:
     * Section 1: The Core Development & Strategic Context
     * Section 2: Key Stakeholders & Operational Timeline
     * Section 3: Industry Implications & Enterprise Risk (Sourced facts + "Our take:" analysis)
     * Section 4: Key Takeaways & What to Watch Next
3. ACCURACY: Ground planned sections in the provided sources. Do not invent topics not supported by research.

OUTPUT REQUIREMENTS:
Output a single valid JSON object strictly matching this schema:
{
  "proposedTitle": "Engaging, authoritative title with clear search intent (under 80 chars, no clickbait)",
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

WRITING & ORIGINALITY SPECIFICATIONS:
- TARGET LENGTH: 900 to 1,400 words. Rich technical depth, zero fluff.
- INLINE CITATION & QUOTE RULES:
  * Every factual claim, number, benchmark value, or quote must come from one of the provided sources and include an inline Markdown link to its URL: [Publisher/Title](url).
  * URL REPETITION CAP: Link to any single source URL at most TWICE in the entire article (first mention and summary/matrix). Do NOT repeat the same link on consecutive sentences; subsequent mentions should use plain text attribution without redundant hyperlinks so prose does not look automated.
  * DIRECT QUOTE CAP: At most 2 direct quotes per article, each strictly UNDER 15 words (maximum 14 words), with explicit attribution. Prefer original explanatory phrasing over block quotes.
  * Facts and numbers must remain strictly accurate as given in the sources.
- STRICT ANTI-PARAPHRASING:
  * Do NOT mirror the sentence structure, paragraph order, or phrasing of the sources.
  * Explain underlying mechanics from first principles using fresh analogies and original phrasing.
  * Cross-reference and synthesize across the different source pillars.
- TOPIC-AWARE CONTENT COMPONENTS:
  * For Deep Technical / Model / Architecture topics:
    - Include an ASCII diagram (\`\`\`text ... \`\`\`) illustrating architecture/topology where applicable. (Do NOT use Mermaid).
    - Include a GitHub-flavored Markdown comparison table comparing metrics against baselines.
    - Include a dedicated H2 "Trade-offs and limitations" section (sourced points + "Our take: [analysis]").
  * For Breaking News / Industry / Policy topics:
    - Focus on strategic analysis, operational realities, and timeline implications without forced ASCII diagrams.
- FORMAT: Return ONLY the raw Markdown text. Do NOT wrap in JSON.
`;
}

export function buildReviewPrompt(
  topic: string,
  draftMarkdown: string,
  sourcesText: string,
): string {
  return `
Perform a rigorous editorial review and quality audit of the following technical draft against the research dossier.

AUDIT CRITERIA:
1. CITATION & FACTUAL ACCURACY:
   - Ensure every empirical metric, number, and factual claim has an inline Markdown citation link to its source.
   - Verify all numbers in the Markdown table match the provided sources exactly. Do NOT alter verified figures.
   - Direct quotes: ensure no more than 2 short quotes (<15 words each), properly attributed.
2. ORIGINALITY & ANTI-MIRRORING AUDIT:
   - Verify the draft does NOT follow the section progression or clause phrasing of any single source.
   - If any sentences closely track source clauses, restructure them with fresh vocabulary and original framing while keeping facts, numbers, and links intact.
3. STRUCTURAL AUDIT:
   - If a technical deep-dive: verify ASCII diagram, comparison table, and "Trade-offs and limitations" section with "Our take:".
   - If a news/policy dispatch: verify coherent narrative with strategic implications.
   - Word count target: 900 to 1,400 words.
4. METADATA GENERATION:
   - Title under 90 characters.
   - metaTitle strictly between 30 and 58 characters.
   - metaDescription strictly between 60 and 150 characters.
   - 2 factual FAQs capturing search intent.
   - Creative imagePrompt following authentic art direction (no text, no distorted faces).

RESEARCH DOSSIER:
${sourcesText}

DRAFT POST:
${draftMarkdown}

OUTPUT REQUIREMENTS:
Output a single valid JSON object strictly matching this schema:
{
  "title": "Compelling, punchy headline under 90 characters",
  "excerpt": "Crisp 2-3 sentence overview (under 250 characters)",
  "contentMd": "Complete polished Markdown post (900-1400 words) with inline source links and structured sections",
  "metaTitle": "Concise SEO title strictly between 30 and 58 characters",
  "metaDescription": "Actionable meta description strictly between 60 and 150 characters",
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
