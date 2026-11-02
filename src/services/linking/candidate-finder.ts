import { sql, eq, and, desc, ne } from "drizzle-orm";
import { getDb } from "@/db/client";
import { posts } from "@/db/schema";

export interface LinkCandidate {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
}

export async function findLinkingCandidates(
  title: string,
  categoryId?: string,
  excludePostId?: string,
  limit = 15,
): Promise<LinkCandidate[]> {
  const db = getDb();
  const trimmed = title.trim();

  const conditions = [eq(posts.status, "published")];
  if (excludePostId) {
    conditions.push(ne(posts.id, excludePostId));
  }

  // Rank by trigram similarity + category match
  const items = await db.query.posts.findMany({
    where: and(...conditions),
    orderBy: [
      desc(sql`similarity(${posts.title}, ${trimmed})`),
      desc(posts.publishedAt),
    ],
    limit,
    columns: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
    },
  });

  return items;
}
