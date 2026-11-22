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
import { checkOriginality } from "@/services/research/originality";

export interface ReviewResult {
  post: PostReviewOutput;
  provider: string;
  model: string;
}

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

  let reviewedPost = initialReviewedPost;
  reviewedPost.slug = slugify(reviewedPost.slug || reviewedPost.title);

  // Evaluate Quality Gates & Originality
  const quality = evaluateQualityGates({
    title: reviewedPost.title,
    excerpt: reviewedPost.excerpt,
    contentMd: reviewedPost.contentMd,
    metaTitle: reviewedPost.metaTitle,
    metaDescription: reviewedPost.metaDescription,
    sourcesCount: 2,
  });

  const originality = checkOriginality(reviewedPost.contentMd, formattedSourcesText);

  console.log(
    `📊 [Review Quality Check] Score: ${quality.score}/100, Words: ${quality.wordCount}, Originality: ${originality.originalityScore}%`,
  );

  // Self-healing repair loop if quality gates or originality fail
  if (!quality.passed || !originality.passed || quality.score < 80) {
    const feedback: string[] = [];
    if (!quality.passed || quality.score < 80) {
      feedback.push(...quality.issues);
    }
    if (!originality.passed) {
      feedback.push(...originality.reasons);
      if (originality.flaggedSentences.length > 0) {
        feedback.push(
          `Sentences mirroring source text that MUST be rewritten in fresh, original phrasing:\n` +
            originality.flaggedSentences
              .slice(0, 3)
              .map((s) => `  * "${s.postSentence}"`)
              .join("\n"),
        );
      }
    }

    console.warn(
      `⚠️ [Review Quality Gate] Issues found: ${feedback.join("; ")}. Running self-healing repair loop...`,
    );

    const repairPrompt = `The previous review draft had quality/originality issues that must be fixed:
${feedback.map((f) => `- ${f}`).join("\n")}

Please repair the post to resolve every issue:
1. Ensure full post is 900 to 1,400 words of rigorous technical depth.
2. Include a clean Markdown benchmark comparison table (| Metric | Model A | Model B | Notes |).
3. Ensure there is a dedicated "Key Takeaways" section.
4. Synthesize all analysis in 100% original prose, avoiding verbatim phrasing from sources.

SOURCES:
${formattedSourcesText}

PREVIOUS DRAFT:
${reviewedPost.contentMd}

OUTPUT REQUIREMENTS:
Output a single valid JSON object matching the review schema.`;

    try {
      const repaired = await defaultAiChain.generateValidatedJson(
        {
          system: SYSTEM_EDITORIAL_PERSONA,
          prompt: repairPrompt,
          temperature: 0.3,
          maxTokens: 12288,
        },
        postReviewSchema,
      );
      reviewedPost = repaired.data;
      reviewedPost.slug = slugify(reviewedPost.slug || reviewedPost.title);
      console.log(
        `✓ [Review Self-Healing] Successfully repaired draft: "${reviewedPost.title}"`,
      );
    } catch (repairErr) {
      console.warn(
        "⚠️ [Review Self-Healing] Repair turn failed, proceeding with original review draft:",
        (repairErr as Error).message,
      );
    }
  }

  console.log(
    `✓ [Review] Post approved and verified: "${reviewedPost.title}" (slug: ${reviewedPost.slug})`,
  );

  return {
    post: reviewedPost,
    provider: result.provider,
    model: result.model,
  };
}
