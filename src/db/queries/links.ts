import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";

export async function getOrphanPosts(): Promise<
  Array<{ id: string; title: string; slug: string; publishedAt: Date | null }>
> {
  const db = getDb();
  // Posts that have zero inbound links from any other published post
  const results = await db.execute<{
    id: string;
    title: string;
    slug: string;
    publishedAt: Date | null;
  }>(sql`
    SELECT p.id, p.title, p.slug, p.published_at as "publishedAt"
    FROM posts p
    LEFT JOIN post_links pl ON pl.to_post_id = p.id
    WHERE p.status = 'published' AND pl.id IS NULL
    ORDER BY p.published_at DESC
  `);

  return Array.from(results.rows || []);
}

export async function getPostLinks(postId: string): Promise<{
  outbound: Array<{
    id: string;
    targetTitle: string;
    targetSlug: string;
    anchor: string;
  }>;
  inbound: Array<{
    id: string;
    sourceTitle: string;
    sourceSlug: string;
    anchor: string;
  }>;
}> {
  const db = getDb();

  const outbound = await db.execute<{
    id: string;
    targetTitle: string;
    targetSlug: string;
    anchor: string;
  }>(sql`
    SELECT pl.id, p.title as "targetTitle", p.slug as "targetSlug", pl.anchor
    FROM post_links pl
    JOIN posts p ON p.id = pl.to_post_id
    WHERE pl.from_post_id = ${postId}
  `);

  const inbound = await db.execute<{
    id: string;
    sourceTitle: string;
    sourceSlug: string;
    anchor: string;
  }>(sql`
    SELECT pl.id, p.title as "sourceTitle", p.slug as "sourceSlug", pl.anchor
    FROM post_links pl
    JOIN posts p ON p.id = pl.from_post_id
    WHERE pl.to_post_id = ${postId}
  `);

  return {
    outbound: Array.from(outbound.rows || []),
    inbound: Array.from(inbound.rows || []),
  };
}
