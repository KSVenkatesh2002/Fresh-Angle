import { eq, desc, and, count, ne, sql } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { posts } from '@/db/schema';
import { siteConfig } from '@/config/site';
import { PostWithRelations, PaginatedPostsResult } from './posts-types';

export async function getPublishedPosts(params: {
  page?: number;
  limit?: number;
}): Promise<PaginatedPostsResult> {
  const page = Math.max(1, params.page || 1);
  const limit = Math.max(1, params.limit || siteConfig.postsPerPage || 12);
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
      tags: { with: { tag: true } },
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
  };
}

export async function getPostBySlug(slug: string): Promise<PostWithRelations | null> {
  const db = getDb();
  const post = await db.query.posts.findFirst({
    where: eq(posts.slug, slug),
    with: {
      category: true,
      tags: { with: { tag: true } },
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

export async function getRelatedPosts(
  postId: string,
  categoryId: string | null,
  limit = 3
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
      tags: { with: { tag: true } },
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

export async function getArchiveMonths(): Promise<Array<{ year: number; month: number; count: number }>> {
  const db = getDb();
  const result = await db.execute<{ year: number; month: number; count: number }>(sql`
    SELECT 
      EXTRACT(YEAR FROM published_at)::int as year,
      EXTRACT(MONTH FROM published_at)::int as month,
      COUNT(*)::int as count
    FROM posts
    WHERE status = 'published' AND published_at IS NOT NULL
    GROUP BY 1, 2
    ORDER BY 1 DESC, 2 DESC
  `);
  return Array.from(result.rows || []);
}
