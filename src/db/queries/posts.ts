import { eq, desc, and, count, ilike, or, ne } from 'drizzle-orm';
import { getDb } from '@/db/client';
import {
  posts,
  categories,
  tags,
  postTags,
  postSources,
  Post,
  NewPost,
  Category,
  Tag,
  PostSource,
} from '@/db/schema';

export interface PostWithRelations extends Post {
  category: Category | null;
  tags: Tag[];
  sources: PostSource[];
}

export interface PaginatedPostsResult {
  posts: PostWithRelations[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function getPublishedPosts(params: {
  page?: number;
  limit?: number;
}): Promise<PaginatedPostsResult> {
  const page = Math.max(1, params.page || 1);
  const limit = Math.max(1, params.limit || 10);
  const offset = (page - 1) * limit;

  const db = getDb();

  const [totalCount] = await db
    .select({ val: count() })
    .from(posts)
    .where(eq(posts.status, 'published'));

  const total = totalCount?.val ?? 0;

  const items = await db.query.posts.findMany({
    where: eq(posts.status, 'published'),
    orderBy: [desc(posts.publishedAt)],
    limit,
    offset,
    with: {
      category: true,
      tags: {
        with: {
          tag: true,
        },
      },
      sources: true,
    },
  });

  const formattedPosts: PostWithRelations[] = items.map((p) => ({
    ...p,
    category: p.category,
    tags: p.tags.map((t) => t.tag),
    sources: p.sources,
  }));

  return {
    posts: formattedPosts,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

export async function getPostBySlug(slug: string): Promise<PostWithRelations | null> {
  const db = getDb();
  const post = await db.query.posts.findFirst({
    where: eq(posts.slug, slug),
    with: {
      category: true,
      tags: {
        with: {
          tag: true,
        },
      },
      sources: true,
    },
  });

  if (!post) return null;

  return {
    ...post,
    category: post.category,
    tags: post.tags.map((t) => t.tag),
    sources: post.sources,
  };
}

export async function getPostsByCategory(
  categorySlug: string,
  params: { page?: number; limit?: number } = {}
): Promise<PaginatedPostsResult & { category: Category | null }> {
  const page = Math.max(1, params.page || 1);
  const limit = Math.max(1, params.limit || 10);
  const offset = (page - 1) * limit;

  const db = getDb();
  const category = await db.query.categories.findFirst({
    where: eq(categories.slug, categorySlug),
  });

  if (!category) {
    return {
      posts: [],
      total: 0,
      page,
      limit,
      totalPages: 1,
      category: null,
    };
  }

  const [totalCount] = await db
    .select({ val: count() })
    .from(posts)
    .where(and(eq(posts.status, 'published'), eq(posts.categoryId, category.id)));

  const total = totalCount?.val ?? 0;

  const items = await db.query.posts.findMany({
    where: and(eq(posts.status, 'published'), eq(posts.categoryId, category.id)),
    orderBy: [desc(posts.publishedAt)],
    limit,
    offset,
    with: {
      category: true,
      tags: {
        with: {
          tag: true,
        },
      },
      sources: true,
    },
  });

  return {
    posts: items.map((p) => ({
      ...p,
      category: p.category,
      tags: p.tags.map((t) => t.tag),
      sources: p.sources,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
    category,
  };
}

export async function getPostsByTag(
  tagSlug: string,
  params: { page?: number; limit?: number } = {}
): Promise<PaginatedPostsResult & { tag: Tag | null }> {
  const page = Math.max(1, params.page || 1);
  const limit = Math.max(1, params.limit || 10);
  const offset = (page - 1) * limit;

  const db = getDb();
  const tag = await db.query.tags.findFirst({
    where: eq(tags.slug, tagSlug),
  });

  if (!tag) {
    return {
      posts: [],
      total: 0,
      page,
      limit,
      totalPages: 1,
      tag: null,
    };
  }

  const postTagsRows = await db.query.postTags.findMany({
    where: eq(postTags.tagId, tag.id),
  });
  const postIds = postTagsRows.map((r) => r.postId);

  if (postIds.length === 0) {
    return {
      posts: [],
      total: 0,
      page,
      limit,
      totalPages: 1,
      tag,
    };
  }

  const items = await db.query.posts.findMany({
    where: and(eq(posts.status, 'published')),
    orderBy: [desc(posts.publishedAt)],
    with: {
      category: true,
      tags: {
        with: {
          tag: true,
        },
      },
      sources: true,
    },
  });

  const matchingPosts = items
    .filter((p) => postIds.includes(p.id))
    .slice(offset, offset + limit);

  return {
    posts: matchingPosts.map((p) => ({
      ...p,
      category: p.category,
      tags: p.tags.map((t) => t.tag),
      sources: p.sources,
    })),
    total: postIds.length,
    page,
    limit,
    totalPages: Math.ceil(postIds.length / limit) || 1,
    tag,
  };
}

export async function getRelatedPosts(
  postId: string,
  categoryId: string | null,
  limit: number = 3
): Promise<PostWithRelations[]> {
  const db = getDb();
  const items = await db.query.posts.findMany({
    where: and(
      eq(posts.status, 'published'),
      ne(posts.id, postId),
      categoryId ? eq(posts.categoryId, categoryId) : undefined
    ),
    orderBy: [desc(posts.publishedAt)],
    limit,
    with: {
      category: true,
      tags: {
        with: {
          tag: true,
        },
      },
      sources: true,
    },
  });

  return items.map((p) => ({
    ...p,
    category: p.category,
    tags: p.tags.map((t) => t.tag),
    sources: p.sources,
  }));
}

export async function searchPosts(
  query: string,
  limit: number = 20
): Promise<PostWithRelations[]> {
  if (!query || query.trim().length === 0) return [];
  const db = getDb();
  const searchPattern = `%${query.trim()}%`;

  const items = await db.query.posts.findMany({
    where: and(
      eq(posts.status, 'published'),
      or(
        ilike(posts.title, searchPattern),
        ilike(posts.excerpt, searchPattern),
        ilike(posts.contentMd, searchPattern)
      )
    ),
    orderBy: [desc(posts.publishedAt)],
    limit,
    with: {
      category: true,
      tags: {
        with: {
          tag: true,
        },
      },
      sources: true,
    },
  });

  return items.map((p) => ({
    ...p,
    category: p.category,
    tags: p.tags.map((t) => t.tag),
    sources: p.sources,
  }));
}

export async function getAllPostSlugs(): Promise<string[]> {
  const db = getDb();
  const results = await db
    .select({ slug: posts.slug })
    .from(posts)
    .where(eq(posts.status, 'published'));

  return results.map((r) => r.slug);
}

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
        publishedAt: params.post.status === 'published' ? new Date() : null,
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
  status: 'draft' | 'published' | 'archived'
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
