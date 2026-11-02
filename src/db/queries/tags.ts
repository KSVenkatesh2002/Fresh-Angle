import { inArray, eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { tags, Tag } from '@/db/schema';
import { slugify } from '@/lib/utils/slug';

export async function getAllTags(): Promise<Tag[]> {
  const db = getDb();
  return db.query.tags.findMany({
    orderBy: (t, { asc }) => [asc(t.name)],
  });
}

export async function getTagsWithCounts(): Promise<Array<Tag & { postCount: number }>> {
  const db = getDb();
  const allTags = await db.query.tags.findMany({
    orderBy: (t, { asc }) => [asc(t.name)],
    with: {
      posts: {
        columns: { postId: true },
      },
    },
  });

  return allTags.map((t) => ({
    ...t,
    postCount: t.posts?.length || 0,
  }));
}



export async function getTagBySlug(slug: string): Promise<Tag | null> {
  const db = getDb();
  const tag = await db.query.tags.findFirst({
    where: eq(tags.slug, slug),
  });
  return tag ?? null;
}

export async function getOrCreateTags(rawTagNames: string[]): Promise<Tag[]> {
  if (rawTagNames.length === 0) return [];
  const db = getDb();

  const normalized = rawTagNames.map((name) => {
    const trimmed = name.trim();
    return {
      name: trimmed,
      slug: slugify(trimmed),
    };
  }).filter((t) => t.slug.length > 0);

  if (normalized.length === 0) return [];

  const slugs = normalized.map((t) => t.slug);
  const existing = await db.query.tags.findMany({
    where: inArray(tags.slug, slugs),
  });

  const existingSlugs = new Set(existing.map((t) => t.slug));
  const toInsert = normalized.filter((t) => !existingSlugs.has(t.slug));

  if (toInsert.length > 0) {
    const newlyInserted = await db
      .insert(tags)
      .values(toInsert)
      .onConflictDoNothing()
      .returning();

    return [...existing, ...newlyInserted];
  }

  return existing;
}
