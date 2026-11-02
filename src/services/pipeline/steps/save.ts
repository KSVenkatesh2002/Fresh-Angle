import { dbImageStorage } from '@/db/client';
import { upsertCategory } from '@/db/queries/categories';
import { getOrCreateTags } from '@/db/queries/tags';
import { createPostWithRelations } from '@/db/queries/posts';
import { PostReviewOutput } from '@/services/pipeline/schemas';
import { GeneratedCoverResult } from '@/services/images/cover';
import { ExtractedArticleSource } from '@/services/research/sources';
import { calculateReadingTime } from '@/lib/utils/reading-time';
import { slugify, generateTopicKey } from '@/lib/utils/slug';
import { Post } from '@/db/schema';

export interface SavePostParams {
  post: PostReviewOutput;
  cover: GeneratedCoverResult;
  sources: ExtractedArticleSource[];
  aiProvider: string;
  aiModel: string;
  autoPublish: boolean;
}

export async function stepSave(params: SavePostParams): Promise<Post> {
  console.log('💾 [Step 7/8: Save & Publish] Saving post, cover image, tags, and sources in database transaction...');

  // 1. Save cover image into post_images via ImageStorage abstraction
  const imageId = await dbImageStorage.saveImage({
    data: params.cover.buffer,
    mime: 'image/webp',
    width: 1200,
    height: 630,
  });

  // 2. Ensure category exists
  const categorySlug = slugify(params.post.category);
  const category = await upsertCategory({
    slug: categorySlug,
    name: params.post.category,
    description: `Articles and dispatches on ${params.post.category}.`,
  });

  // 3. Ensure tags exist
  const tagRecords = await getOrCreateTags(params.post.tags);
  const tagIds = tagRecords.map((t) => t.id);

  // 4. Calculate reading time and topic key
  const readingTimeMin = calculateReadingTime(params.post.contentMd);
  const topicKey = generateTopicKey(params.post.title);
  const status = params.autoPublish ? 'published' : 'draft';

  // 5. Create post with relations
  const savedPost = await createPostWithRelations({
    post: {
      slug: params.post.slug,
      title: params.post.title,
      excerpt: params.post.excerpt,
      contentMd: params.post.contentMd,
      metaTitle: params.post.metaTitle,
      metaDescription: params.post.metaDescription,
      categoryId: category.id,
      status,
      coverImageId: imageId,
      coverAlt: params.cover.alt,
      coverCredit: params.cover.credit,
      coverSource: params.cover.source,
      readingTimeMin,
      aiProvider: params.aiProvider,
      aiModel: params.aiModel,
      topicKey,
    },
    tagIds,
    sources: params.sources.map((s) => ({
      url: s.url,
      title: s.title,
      publisher: s.publisher,
    })),
  });

  console.log(
    `✓ [Save & Publish] Post "${savedPost.title}" saved successfully as status "${status}". ID: ${savedPost.id}`
  );

  return savedPost;
}
