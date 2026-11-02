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
  const { data: reviewedPost, result } =
    await defaultAiChain.generateValidatedJson(
      {
        system: SYSTEM_EDITORIAL_PERSONA,
        prompt,
        temperature: 0.3,
      },
      postReviewSchema,
    );

  // Guarantee clean slug
  reviewedPost.slug = slugify(reviewedPost.slug || reviewedPost.title);

  console.log(
    `✓ [Review] Post approved and verified: "${reviewedPost.title}" (slug: ${reviewedPost.slug})`,
  );

  return {
    post: reviewedPost,
    provider: result.provider,
    model: result.model,
  };
}
