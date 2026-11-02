import { getCoverImage, GeneratedCoverResult } from '@/services/images/cover';
import { PostReviewOutput } from '@/services/pipeline/schemas';

export async function stepCover(
  reviewedPost: PostReviewOutput
): Promise<GeneratedCoverResult> {
  console.log('🎨 [Step 6/8: Cover Image] Executing cover image generation pipeline...');

  const mainKeyword = reviewedPost.tags[0] || reviewedPost.category || 'Artificial Intelligence';

  const coverResult = await getCoverImage({
    prompt: reviewedPost.imagePrompt,
    keyword: mainKeyword,
    title: reviewedPost.title,
    category: reviewedPost.category,
    altText: reviewedPost.imageAlt,
  });

  console.log(
    `✓ [Cover Image] Successfully acquired cover via ${coverResult.source} (${coverResult.buffer.length} bytes)`
  );

  return coverResult;
}
