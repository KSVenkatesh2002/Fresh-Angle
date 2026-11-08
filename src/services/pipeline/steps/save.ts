import { getDb } from "@/db/client";
import { postImages, Post } from "@/db/schema";
import { upsertCategory } from "@/db/queries/categories";
import { getOrCreateTags } from "@/db/queries/tags";
import { createPostWithRelations } from "@/db/queries/posts";
import { PostReviewOutput } from "@/services/pipeline/schemas";
import { GeneratedCoverResult } from "@/services/images/cover";
import { ExtractedArticleSource } from "@/services/research/sources";
import { calculateReadingTime } from "@/lib/utils/reading-time";
import { slugify, generateTopicKey } from "@/lib/utils/slug";
import { getImageStorage } from "@/services/storage/cloudinary";
import { getEnv } from "@/lib/env";

export interface SavePostParams {
  post: PostReviewOutput;
  cover: GeneratedCoverResult;
  sources: ExtractedArticleSource[];
  aiProvider: string;
  aiModel: string;
  autoPublish: boolean;
  isTest?: boolean;
}

export async function stepSave(params: SavePostParams): Promise<Post> {
  console.log(
    "💾 [Step 7/8: Save & Publish] Saving post, cover image, tags, and sources in database transaction...",
  );

  let coverImageId: string | null = null;
  let coverImageUrl: string | null = null;
  let autoPublishStatus = params.autoPublish;

  // 1. Upload cover image directly to Cloudinary via ImageStorage (never writes bytea to DB)
  try {
    const storage = getImageStorage();
    const uploadResult = await storage.put(params.cover.buffer, {
      slug: params.post.slug,
      altText: params.cover.alt,
      width: 1200,
      height: 630,
    });

    coverImageUrl = uploadResult.publicUrl;

    const db = getDb();
    const [inserted] = await db
      .insert(postImages)
      .values({
        data: null, // Zero DB bloat: data column remains null for all new images
        mime: "image/webp",
        width: uploadResult.width,
        height: uploadResult.height,
        storageKey: uploadResult.storageKey,
        publicUrl: uploadResult.publicUrl,
        bytes: uploadResult.bytes,
      })
      .returning({ id: postImages.id });

    coverImageId = inserted?.id ?? null;
    console.log(
      `✓ [Save & Publish] Cover image saved to Cloudinary: ${uploadResult.publicUrl} (${Math.round(uploadResult.bytes / 1024)} KB)`,
    );
  } catch (err: unknown) {
    const errorMsg = (err as Error).message || "Unknown Cloudinary upload error";
    console.error(`⚠️ [Save & Publish] Cloudinary cover upload failed: ${errorMsg}`);

    const env = getEnv();
    const fallbackMode = env.IMAGE_FALLBACK || "default_image";

    if (fallbackMode === "draft") {
      console.warn("⚠️ [Save & Publish] IMAGE_FALLBACK=draft: Demoting post status to draft due to missing cover image.");
      autoPublishStatus = false;
      coverImageUrl = null;
    } else {
      console.warn("⚠️ [Save & Publish] IMAGE_FALLBACK=default_image: Using branded static fallback cover.");
      coverImageUrl = "/images/fallback-cover.webp";
    }
  }

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
  const status = params.isTest ? "draft" : (autoPublishStatus ? "published" : "draft");
  const finalTitle = params.isTest && !params.post.title.startsWith("[TEST]")
    ? `[TEST] ${params.post.title}`
    : params.post.title;

  // 5. Create post with relations
  const savedPost = await createPostWithRelations({
    post: {
      slug: params.post.slug,
      title: finalTitle,
      excerpt: params.post.excerpt,
      contentMd: params.post.contentMd,
      metaTitle: params.post.metaTitle,
      metaDescription: params.post.metaDescription,
      categoryId: category.id,
      status,
      origin: params.isTest ? "test" : "auto",
      coverImageId,
      coverImageUrl,
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
    `✓ [Save & Publish] Post "${savedPost.title}" saved successfully as status "${status}". ID: ${savedPost.id}`,
  );

  return savedPost;
}
