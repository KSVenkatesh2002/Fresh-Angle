import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { categories, Category, NewCategory } from "@/db/schema";

export async function getAllCategories(): Promise<Category[]> {
  const db = getDb();
  return db.query.categories.findMany({
    orderBy: (c, { asc }) => [asc(c.name)],
  });
}

export async function getCategoriesWithCounts(): Promise<
  Array<Category & { postCount: number }>
> {
  const db = getDb();
  const cats = await db.query.categories.findMany({
    orderBy: (c, { asc }) => [asc(c.name)],
    with: {
      posts: {
        where: (p, { eq }) => eq(p.status, "published"),
        columns: { id: true },
      },
    },
  });

  return cats.map((c) => ({
    ...c,
    postCount: c.posts?.length || 0,
  }));
}

export async function getCategoryBySlug(
  slug: string,
): Promise<Category | null> {
  const db = getDb();
  const category = await db.query.categories.findFirst({
    where: eq(categories.slug, slug),
  });
  return category ?? null;
}

export async function upsertCategory(
  category: Omit<NewCategory, "id" | "createdAt">,
): Promise<Category> {
  const db = getDb();
  const [result] = await db
    .insert(categories)
    .values(category)
    .onConflictDoUpdate({
      target: categories.slug,
      set: {
        name: category.name,
        description: category.description,
      },
    })
    .returning();

  return result;
}
