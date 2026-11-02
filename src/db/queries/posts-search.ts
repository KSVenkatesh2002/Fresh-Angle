import { sql, eq, and, desc, asc } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { posts, categories } from '@/db/schema';

import { PostWithRelations, PaginatedPostsResult } from './posts-types';

export interface SearchPostsOptions {
  query?: string;
  category?: string;
  tags?: string[];
  from?: string;
  to?: string;
  sort?: 'relevance' | 'newest' | 'oldest' | 'popular';
  page?: number;
  limit?: number;
}

export async function advancedSearchPosts(
  options: SearchPostsOptions
): Promise<PaginatedPostsResult> {
  const db = getDb();
  const page = Math.max(1, options.page || 1);
  const limit = Math.max(1, options.limit || 12);
  const offset = (page - 1) * limit;

  const conditions = [eq(posts.status, 'published')];

  if (options.category) {
    const cat = await db.query.categories.findFirst({
      where: eq(categories.slug, options.category),
    });
    if (cat) {
      conditions.push(eq(posts.categoryId, cat.id));
    }
  }

  if (options.from) {
    conditions.push(sql`${posts.publishedAt} >= ${new Date(options.from)}`);
  }
  if (options.to) {
    conditions.push(sql`${posts.publishedAt} <= ${new Date(options.to)}`);
  }

  const queryText = options.query?.trim();
  if (queryText) {
    // Full text websearch + trigram similarity match
    conditions.push(sql`(
      to_tsvector('english', coalesce(${posts.title}, '') || ' ' || coalesce(${posts.excerpt}, '')) @@ websearch_to_tsquery('english', ${queryText})
      OR similarity(${posts.title}, ${queryText}) > 0.2
      OR ${posts.title} ILIKE ${`%${queryText}%`}
      OR ${posts.excerpt} ILIKE ${`%${queryText}%`}
    )`);
  }

  let orderByClause = [desc(posts.publishedAt)];
  if (options.sort === 'oldest') {
    orderByClause = [asc(posts.publishedAt)];
  } else if (options.sort === 'relevance' && queryText) {
    orderByClause = [
      desc(sql`ts_rank(to_tsvector('english', coalesce(${posts.title}, '') || ' ' || coalesce(${posts.excerpt}, '')), websearch_to_tsquery('english', ${queryText}))`),
      desc(posts.publishedAt),
    ];
  }


  const whereClause = and(...conditions);

  const [totalCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(posts)
    .where(whereClause);

  const total = totalCount?.count ?? 0;

  const items = await db.query.posts.findMany({
    where: whereClause,
    orderBy: orderByClause,
    limit,
    offset,
    with: {
      category: true,
      tags: { with: { tag: true } },
      sources: true,
    },
  });

  const formatted: PostWithRelations[] = items.map((p) => ({
    ...p,
    category: p.category,
    tags: p.tags.map((t) => t.tag),
    sources: p.sources,
  }));

  return {
    posts: formatted,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

export async function getSearchSuggestions(query: string, limit = 5): Promise<Array<{ title: string; slug: string }>> {
  if (!query || query.trim().length < 2) return [];
  const db = getDb();
  const trimmed = query.trim();

  const results = await db
    .select({ title: posts.title, slug: posts.slug })
    .from(posts)
    .where(
      and(
        eq(posts.status, 'published'),
        sql`(${posts.title} ILIKE ${`%${trimmed}%`} OR similarity(${posts.title}, ${trimmed}) > 0.2)`
      )
    )
    .orderBy(desc(sql`similarity(${posts.title}, ${trimmed})`))
    .limit(limit);

  return results;
}

export async function searchPosts(query: string, limit = 20): Promise<PostWithRelations[]> {
  const result = await advancedSearchPosts({ query, limit });
  return result.posts;
}

