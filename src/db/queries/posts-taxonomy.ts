import { eq, desc, and, count, sql } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { posts, categories, tags, postTags, Category, Tag } from '@/db/schema';
import { siteConfig } from '@/config/site';
import { PaginatedPostsResult } from './posts-types';


export async function getPostsByCategory(
  categorySlug: string,
  params: { page?: number; limit?: number } = {}
): Promise<PaginatedPostsResult & { category: Category | null }> {
  const page = Math.max(1, params.page || 1);
  const limit = Math.max(1, params.limit || siteConfig.postsPerPage || 12);
  const offset = (page - 1) * limit;

  const db = getDb();
  const category = await db.query.categories.findFirst({
    where: eq(categories.slug, categorySlug),
  });

  if (!category) {
    return { posts: [], total: 0, page, limit, totalPages: 1, category: null };
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
    category,
  };
}

export async function getPostsByTag(
  tagSlug: string,
  params: { page?: number; limit?: number } = {}
): Promise<PaginatedPostsResult & { tag: Tag | null }> {
  const page = Math.max(1, params.page || 1);
  const limit = Math.max(1, params.limit || siteConfig.postsPerPage || 12);
  const offset = (page - 1) * limit;

  const db = getDb();
  const tag = await db.query.tags.findFirst({
    where: eq(tags.slug, tagSlug),
  });

  if (!tag) {
    return { posts: [], total: 0, page, limit, totalPages: 1, tag: null };
  }

  const postTagsRows = await db.query.postTags.findMany({
    where: eq(postTags.tagId, tag.id),
  });
  const postIds = postTagsRows.map((r) => r.postId);

  if (postIds.length === 0) {
    return { posts: [], total: 0, page, limit, totalPages: 1, tag };
  }

  const items = await db.query.posts.findMany({
    where: eq(posts.status, 'published'),
    orderBy: [desc(posts.publishedAt)],
    with: {
      category: true,
      tags: { with: { tag: true } },
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

export async function getPostsByArchive(
  year: number,
  month: number,
  params: { page?: number; limit?: number } = {}
): Promise<PaginatedPostsResult> {
  const page = Math.max(1, params.page || 1);
  const limit = Math.max(1, params.limit || siteConfig.postsPerPage || 12);
  const offset = (page - 1) * limit;

  const db = getDb();
  const whereClause = and(
    eq(posts.status, 'published'),
    sql`EXTRACT(YEAR FROM ${posts.publishedAt})::int = ${year}`,
    sql`EXTRACT(MONTH FROM ${posts.publishedAt})::int = ${month}`
  );

  const [totalCount] = await db
    .select({ val: count() })
    .from(posts)
    .where(whereClause);

  const total = totalCount?.val ?? 0;
  const items = await db.query.posts.findMany({
    where: whereClause,
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
