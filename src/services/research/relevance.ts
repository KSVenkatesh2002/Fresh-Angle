import { defaultAiChain } from "@/services/ai/fallback";
import { z } from "zod";
import { PIPELINE_CONFIG } from "@/config/pipeline";

export interface SourceRelevanceEvaluation {
  relevant: boolean;
  reason: string;
}

export const BRAND_NAMES = new Set([
  "anthropic",
  "google",
  "openai",
  "nvidia",
  "microsoft",
  "meta",
  "apple",
  "amazon",
  "aws",
  "deepmind",
  "huggingface",
  "cohere",
  "mistral",
  "stability",
  "github",
  "reuters",
  "bloomberg",
  "techcrunch",
  "theverge",
]);

/**
 * Extracts distinctive non-brand topic terms (length >= 3) for targeted multi-source search.
 */
export function extractDistinctiveTopicTerms(title: string): string[] {
  const stopWords = new Set([
    "a", "an", "the", "in", "on", "for", "with", "how", "why", "what", "is",
    "are", "and", "or", "of", "to", "via", "using", "from", "at", "by", "this",
    "that", "into", "introducing", "announcing", "new", "released", "launch",
    "breakthrough", "architecture", "overview", "guide", "deep", "dive",
    "delivers", "delivering", "native", "post", "blog", "article"
  ]);

  const clean = title
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length >= 3 && !stopWords.has(w) && !BRAND_NAMES.has(w));

  return Array.from(new Set(clean));
}

/**
 * Determines whether a topic is technical/research-oriented vs breaking news/industry dispatch.
 */
export function isResearchOrientedTopic(title: string): boolean {
  const researchKeywords = [
    "paper", "arxiv", "research", "algorithm", "architecture", "benchmark",
    "training", "attention", "survey", "weights", "transformer", "inference",
    "scaling", "dataset", "reasoning", "quantization", "fine-tuning", "rlhf", "dpo", "provable"
  ];
  const lower = title.toLowerCase();
  return researchKeywords.some((kw) => lower.includes(kw));
}

/**
 * Performs a fast, cheap LLM check to confirm whether a candidate secondary source
 * is directly relevant to the specific article topic.
 */
export async function verifyRelevanceWithLLM(
  topicTitle: string,
  candidateTitle: string,
  candidateSnippet: string,
): Promise<SourceRelevanceEvaluation> {
  try {
    const prompt = `Topic: "${topicTitle}"
Candidate Source Title: "${candidateTitle}"
Candidate Source Snippet: "${candidateSnippet}"

Is this candidate source directly relevant and technically helpful for writing an in-depth article on the topic? Answer false if it is merely mentioning a general company/brand or unrelated topic.
Answer strictly in JSON:
{
  "relevant": true or false,
  "reason": "1-sentence concise reason"
}`;

    const res = await defaultAiChain.generateValidatedJson(
      {
        system: "You are a research relevance auditor. Evaluate whether candidate sources are directly on-topic.",
        prompt,
        temperature: 0.1,
        maxTokens: 256,
      },
      z.object({
        relevant: z.boolean(),
        reason: z.string(),
      }),
    );
    return res.data;
  } catch (err) {
    console.warn("⚠️ [LLM Relevance Check] Fallback due to error:", (err as Error).message);
    return { relevant: true, reason: "Heuristic fallback" };
  }
}

/**
 * Evaluates whether a search result is sufficiently relevant to the topic
 * based on Tavily confidence score, at least 2 non-brand topic keyword hits,
 * and a cheap LLM relevance verification.
 */
export async function isRelevantSource(
  r: { title: string; content: string; score: number },
  topicTitleOrKeywords: string,
  minScore = PIPELINE_CONFIG.limits.minTavilyRelevanceScore,
): Promise<SourceRelevanceEvaluation> {
  if (r.score < minScore) {
    return {
      relevant: false,
      reason: `Tavily score ${r.score.toFixed(2)} is below minimum ${minScore}`,
    };
  }

  const distinctiveTerms = extractDistinctiveTopicTerms(topicTitleOrKeywords);
  const termsToCheck =
    distinctiveTerms.length > 0
      ? distinctiveTerms
      : topicTitleOrKeywords.toLowerCase().split(/\s+/).filter((k) => k.length > 2);

  const text = (r.title + " " + r.content).toLowerCase();
  const matchedTerms = termsToCheck.filter((term) => text.includes(term));
  const minRequiredHits = Math.min(2, termsToCheck.length);

  if (matchedTerms.length < minRequiredHits) {
    return {
      relevant: false,
      reason: `Matched only ${matchedTerms.length}/${minRequiredHits} distinctive non-brand terms (${matchedTerms.join(", ") || "none"})`,
    };
  }

  const llmCheck = await verifyRelevanceWithLLM(
    topicTitleOrKeywords,
    r.title,
    r.content.slice(0, 300),
  );

  if (!llmCheck.relevant) {
    return {
      relevant: false,
      reason: `LLM evaluation: ${llmCheck.reason}`,
    };
  }

  return {
    relevant: true,
    reason: `Passed score (${r.score.toFixed(2)}), 2+ terms (${matchedTerms.join(", ")}), and LLM check`,
  };
}

