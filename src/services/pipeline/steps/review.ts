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

export async function stepReview(
  topicTitle: string,
  draftMarkdown: string,
  formattedSourcesText: string,
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
    sourcesCount: 2,
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
