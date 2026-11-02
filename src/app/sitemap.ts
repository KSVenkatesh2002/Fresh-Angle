import type { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';
import { getDb } from '@/db/client';
import { posts, categories, tags } from '@/db/schema';
import { eq } from 'drizzle-orm';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: siteConfig.url,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${siteConfig.url}/blog`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${siteConfig.url}/search`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${siteConfig.url}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${siteConfig.url}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${siteConfig.url}/privacy-policy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${siteConfig.url}/ai-disclosure`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
  ];

  try {
    const db = getDb();

    // Published Posts
    const allPosts = await db
      .select({
        slug: posts.slug,
        updatedAt: posts.updatedAt,
        publishedAt: posts.publishedAt,
      })
      .from(posts)
      .where(eq(posts.status, 'published'));

    const postRoutes: MetadataRoute.Sitemap = allPosts.map((p) => ({
      url: `${siteConfig.url}/blog/${p.slug}`,
      lastModified: p.updatedAt || p.publishedAt || new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    }));

    // Categories
    const allCategories = await db.select({ slug: categories.slug }).from(categories);
    const categoryRoutes: MetadataRoute.Sitemap = allCategories.map((c) => ({
      url: `${siteConfig.url}/category/${c.slug}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.7,
    }));

    // Tags
    const allTags = await db.select({ slug: tags.slug }).from(tags);
    const tagRoutes: MetadataRoute.Sitemap = allTags.map((t) => ({
      url: `${siteConfig.url}/tag/${t.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.5,
    }));

    return [...staticRoutes, ...postRoutes, ...categoryRoutes, ...tagRoutes];
  } catch (err) {
    console.warn(`⚠️ [Sitemap] Could not query database for dynamic URLs: ${(err as Error).message}`);
    return staticRoutes;
  }
}
