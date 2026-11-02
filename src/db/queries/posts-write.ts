import { eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { posts, postTags, postSources, Post, NewPost } from '@/db/schema';

export interface CreatePostParams {
  post: Omit<NewPost, 'id' | 'createdAt' | 'updatedAt'>;
  tagIds: string[];
  sources: Array<{ url: string; title: string; publisher: string }>;
}

export async function createPostWithRelations(params: CreatePostParams): Promise<Post> {
  const db = getDb();

  return await db.transaction(async (tx) => {
    const [insertedPost] = await tx
      .insert(posts)
      .values({
        ...params.post,
        publishedAt: params.post.status === 'published' ? (params.post.publishedAt || new Date()) : null,
      })
      .returning();

    if (!insertedPost) {
      throw new Error('Failed to create post');
    }

    if (params.tagIds.length > 0) {
      await tx.insert(postTags).values(
        params.tagIds.map((tagId) => ({
          postId: insertedPost.id,
          tagId,
        }))
      );
    }

    if (params.sources.length > 0) {
      await tx.insert(postSources).values(
        params.sources.map((s) => ({
          postId: insertedPost.id,
          url: s.url,
          title: s.title,
          publisher: s.publisher,
        }))
      );
    }

    return insertedPost;
  });
}

export async function updatePostStatus(
  id: string,
  status: 'draft' | 'scheduled' | 'published' | 'archived'
): Promise<Post> {
  const db = getDb();
  const [updated] = await db
    .update(posts)
    .set({
      status,
      publishedAt: status === 'published' ? new Date() : undefined,
      updatedAt: new Date(),
    })
    .where(eq(posts.id, id))
    .returning();

  if (!updated) {
    throw new Error(`Post with id ${id} not found`);
  }

  return updated;
}

export async function deletePost(id: string): Promise<boolean> {
  const db = getDb();
  const deleted = await db.delete(posts).where(eq(posts.id, id)).returning({ id: posts.id });
  return deleted.length > 0;
}
