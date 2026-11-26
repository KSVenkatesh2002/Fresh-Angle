import { defaultAiChain } from "@/services/ai/fallback";
import {
  postReviewSchema,
  PostReviewOutput,
} from "@/services/pipeline/schemas";
import {
  SYSTEM_EDITORIAL_PERSONA,
  buildReviewPrompt,
} from "@/services/pipeline/prompts/templates";
import { slugify } from "@/lib/utils/slug";
import { evaluateQualityGates } from "@/services/seo/quality-gates";
import {
  checkOriginality,
  checkOriginalityWebGate,
  findUnsupportedNumbers,
  OriginalityCheckResult,
} from "@/services/research/originality";
import { capRepeatedUrlLinks, analyzeCitations } from "@/services/research/sources";
import { PIPELINE_CONFIG } from "@/config/pipeline";
import { z } from "zod";

export interface ReviewResult {
  post: PostReviewOutput;
  provider: string;
  model: string;
  tokensUsed?: { prompt: number; completion: number; total: number };
  originality: OriginalityCheckResult;
}

const sentenceRewriteSchema = z.object({
  rewrites: z.array(
    z.object({
      original: z.string(),
      revised: z.string(),
    }),
  ),
});

export interface ReviewOptions {
  availableSourcesCount?: number;
}

export async function stepReview(
  topicTitle: string,
  draftMarkdown: string,
  formattedSourcesText: string,
  options: ReviewOptions = {},
): Promise<ReviewResult> {
  console.log(
    "🧐 [Step 5/8: Review] Fact-checking, sharpening, and producing verified post JSON (AI call 3)...",
  );

  const prompt = buildReviewPrompt(
    topicTitle,
    draftMarkdown,
    formattedSourcesText,
  );
  const { data: initialReviewedPost, result } =
    await defaultAiChain.generateValidatedJson(
      {
        system: SYSTEM_EDITORIAL_PERSONA,
        prompt,
        temperature: 0.3,
        maxTokens: 12288,
      },
      postReviewSchema,
    );

  const reviewedPost = initialReviewedPost;
  reviewedPost.slug = slugify(reviewedPost.slug || reviewedPost.title);

  // 1. Enforce URL repetition cap (max 2 links per URL)
  reviewedPost.contentMd = capRepeatedUrlLinks(
    reviewedPost.contentMd,
    PIPELINE_CONFIG.originality.maxLinksPerUrl,
  );

  // 2. Evaluate Quality Gates & Originality
  const quality = evaluateQualityGates({
    title: reviewedPost.title,
    excerpt: reviewedPost.excerpt,
    contentMd: reviewedPost.contentMd,
    metaTitle: reviewedPost.metaTitle,
    metaDescription: reviewedPost.metaDescription,
    sourcesCount: options.availableSourcesCount ?? 1,
  });

  let originality = checkOriginality(reviewedPost.contentMd, formattedSourcesText);
  const citations = analyzeCitations(reviewedPost.contentMd);

  console.log(
    `📊 [Review Quality Check] Score: ${quality.score}/100, Words: ${quality.wordCount}, Originality: ${originality.originalityScore}%, 3-gram: ${(originality.overlap3Gram * 100).toFixed(1)}%, Max Run: ${originality.maxConsecutiveWordsRun}w, Distinct Links: ${citations.distinctUrls}`,
  );

  let totalTokensPrompt = result.tokensIn || 0;
  let totalTokensCompletion = result.tokensOut || 0;

  // 3. Targeted Sentence Rewrite Loop (Max 2 attempts, bounded LLM cost)
  const maxRewriteAttempts = PIPELINE_CONFIG.originality.maxRewriteAttempts || 2;
  let rewriteAttempt = 0;

  while (!originality.passed && originality.flaggedSentences.length > 0 && rewriteAttempt < maxRewriteAttempts) {
    rewriteAttempt++;
    console.warn(
      `⚠️ [Review Originality Gate] Attempt ${rewriteAttempt}/${maxRewriteAttempts}: ${originality.flaggedSentences.length} sentence(s) mirror source text > 50%. Running targeted rewrite...`,
    );

    const sentencesToRewrite = originality.flaggedSentences.slice(0, 5);
    const rewritePrompt = `We are revising targeted sentences to eliminate phrasing overlap with research sources while preserving 100% factual accuracy.

SENTENCES TO REWRITE:
${sentencesToRewrite.map((s, idx) => `[Sentence ${idx + 1}]: "${s.postSentence}"\n(Source match: "${s.sourceSentence}")`).join("\n\n")}

REQUIREMENTS:
1. Restructure each sentence completely: vary clause order, shift active/passive voice, use fresh analytical phrasing.
2. PRESERVE STRICTLY: Keep all empirical numbers, percentages, benchmark metrics, and Markdown link URLs [Text](url) completely intact.
3. Return a JSON object matching this schema:
{
  "rewrites": [
    { "original": "original sentence string", "revised": "completely restructured sentence string" }
  ]
}

Respond ONLY with valid JSON.`;

    try {
      const rewriteResult = await defaultAiChain.generateValidatedJson(
        {
          system: "You are a senior technical editor specializing in prose restructuring and original synthesis.",
          prompt: rewritePrompt,
          temperature: 0.2,
          maxTokens: 2048,
        },
        sentenceRewriteSchema,
      );

      totalTokensPrompt += rewriteResult.result.tokensIn || 0;
      totalTokensCompletion += rewriteResult.result.tokensOut || 0;

      for (const item of rewriteResult.data.rewrites) {
        if (item.original && item.revised && reviewedPost.contentMd.includes(item.original)) {
          reviewedPost.contentMd = reviewedPost.contentMd.replace(item.original, item.revised);
        }
      }

      // Re-cap links and re-check originality
      reviewedPost.contentMd = capRepeatedUrlLinks(
        reviewedPost.contentMd,
        PIPELINE_CONFIG.originality.maxLinksPerUrl,
      );
      originality = checkOriginality(reviewedPost.contentMd, formattedSourcesText);
      console.log(
        `✓ [Review Targeted Rewrite] Post re-checked: Originality ${originality.originalityScore}%, Flagged: ${originality.flaggedSentences.length}`,
      );
    } catch (rewriteErr) {
      console.warn("⚠️ [Review Targeted Rewrite] Rewrite attempt failed:", (rewriteErr as Error).message);
      break;
    }
  }

  // If still failing after max attempts, mark post as needs_review
  if (!originality.passed) {
    console.warn(
      `⚠️ [Review Originality Gate] Post exceeded thresholds after ${rewriteAttempt} rewrite attempts. Setting status to 'needs_review'. Reasons: ${originality.reasons.join("; ")}`,
    );
    // Mark on object so save step preserves 'needs_review'
    (reviewedPost as Record<string, unknown>).status = "needs_review";
  }

  // 4. Optional Final Web-Check Gate (behind enableWebCheckGate flag, default false)
  if (PIPELINE_CONFIG.originality.enableWebCheckGate) {
    console.log("🌐 [Review Web Gate] Running optional live web check across 3 sample sentences...");
    const sampleSentences = originality.flaggedSentences.map((s) => s.postSentence).slice(0, 3);
    const webCheck = await checkOriginalityWebGate(reviewedPost.contentMd, sampleSentences);
    if (!webCheck.passed) {
      console.warn("⚠️ [Review Web Gate] Live web search hit matching third-party text. Marking needs_review.");
      (reviewedPost as Record<string, unknown>).status = "needs_review";
    }
  }

  // 5. Multi-Source Diversity & Integrity Gate
  const availableSourcesCount = options.availableSourcesCount ?? 1;
  const finalCitations = analyzeCitations(reviewedPost.contentMd);
  const isEditorialRefusal =
    /^(why this draft fails|editorial audit|unable to generate)/i.test(reviewedPost.title.trim()) ||
    /inability to produce a technical dispatch|referenced .* provides no concrete details/i.test(
      reviewedPost.contentMd.slice(0, 800),
    );

  if (isEditorialRefusal) {
    console.warn(
      `⚠️ [Review Integrity Gate] Detected editorial refusal / insufficient source meta-post ("${reviewedPost.title}"). Forcing status to 'needs_review'.`,
    );
    (reviewedPost as Record<string, unknown>).status = "needs_review";
  }

  if (finalCitations.distinctUrls < 2) {
    (reviewedPost as Record<string, unknown>).researchDepth = "single";

    const mustBlockPublish =
      finalCitations.distinctUrls === 0 ||
      availableSourcesCount >= 2 ||
      PIPELINE_CONFIG.originality.requireMultiSource;

    if (mustBlockPublish) {
      console.warn(
        `⚠️ [Review Citation Gate] Draft cites ${finalCitations.distinctUrls} distinct source(s) (available: ${availableSourcesCount}). Setting researchDepth to 'single' and forcing status to 'needs_review'.`,
      );
      (reviewedPost as Record<string, unknown>).status = "needs_review";
    } else {
      console.log(
        `ℹ️ [Review Citation Gate] Single-source topic (${finalCitations.distinctUrls} cited of ${availableSourcesCount} available). Marking researchDepth='single'; originality and number gates apply.`,
      );
    }
  }

  // 6. Strict Number Grounding Gate: verify numbers with units, %, x, or $ against sources
  let unsupportedNumbers = findUnsupportedNumbers(
    reviewedPost.contentMd,
    formattedSourcesText,
  );

  if (unsupportedNumbers.length > 0) {
    console.warn(
      `⚠️ [Review Number Gate] Found ${unsupportedNumbers.length} unverified number/metric claims not in sources: ${unsupportedNumbers.join(", ")}. Triggering targeted rewrite...`,
    );

    const numberRewritePrompt = `Strict number grounding audit failed. The following numbers, multipliers, percentages, or prices appear in the draft but are NOT supported by the research sources:
${unsupportedNumbers.map((n) => `- ${n}`).join("\n")}

RESEARCH DOSSIER:
${formattedSourcesText}

DRAFT POST CONTENT:
${reviewedPost.contentMd}

REQUIREMENTS:
1. Revise the draft content to completely remove every unsupported number, multiplier (e.g. 70x), percentage, or price claim ($).
2. If an unsupported number is part of a comparison table row, OMIT the row entirely or describe the relationship qualitatively in prose without fabricated figures.
3. Keep all verified source facts, empirical metrics that ARE in the research dossier, citations, and markdown structure intact.
4. Output a single JSON object strictly matching:
{
  "revisedContentMd": "the complete revised markdown content"
}

Respond ONLY with valid JSON.`;

    try {
      const numberRewriteResult = await defaultAiChain.generateValidatedJson(
        {
          system:
            "You are a senior technical copy editor strictly enforcing empirical factual grounding and zero hallucinated metrics.",
          prompt: numberRewritePrompt,
          temperature: 0.2,
          maxTokens: 12288,
        },
        z.object({
          revisedContentMd: z.string(),
        }),
      );

      totalTokensPrompt += numberRewriteResult.result.tokensIn || 0;
      totalTokensCompletion += numberRewriteResult.result.tokensOut || 0;

      reviewedPost.contentMd = capRepeatedUrlLinks(
        numberRewriteResult.data.revisedContentMd,
        PIPELINE_CONFIG.originality.maxLinksPerUrl,
      );

      // Re-verify after rewrite
      unsupportedNumbers = findUnsupportedNumbers(
        reviewedPost.contentMd,
        formattedSourcesText,
      );

      if (unsupportedNumbers.length > 0) {
        console.warn(
          `⚠️ [Review Number Gate] ${unsupportedNumbers.length} unsupported numbers remained after rewrite: ${unsupportedNumbers.join(", ")}. Forcing status to 'needs_review'.`,
        );
        (reviewedPost as Record<string, unknown>).status = "needs_review";
      } else {
        console.log(
          `✓ [Review Number Gate] All numbers successfully grounded after targeted rewrite.`,
        );
      }
    } catch (rewriteErr) {
      console.warn(
        `⚠️ [Review Number Gate] Rewrite failed: ${(rewriteErr as Error).message}. Marking needs_review.`,
      );
      (reviewedPost as Record<string, unknown>).status = "needs_review";
    }
  }

  console.log(
    `✓ [Review] Post approved and verified: "${reviewedPost.title}" (slug: ${reviewedPost.slug}, tokens: ${totalTokensPrompt + totalTokensCompletion})`,
  );

  return {
    post: reviewedPost,
    provider: result.provider,
    model: result.model,
    tokensUsed: {
      prompt: totalTokensPrompt,
      completion: totalTokensCompletion,
      total: totalTokensPrompt + totalTokensCompletion,
    },
    originality,
  };
}
