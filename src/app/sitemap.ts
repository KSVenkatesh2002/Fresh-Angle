import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { getDb } from "@/db/client";
import { posts, categories, tags } from "@/db/schema";
import { eq } from "drizzle-orm";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = getDb();

  const staticUrls: MetadataRoute.Sitemap = [
    {
      url: siteConfig.url,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${siteConfig.url}/blog`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${siteConfig.url}/categories`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${siteConfig.url}/tags`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${siteConfig.url}/archive`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${siteConfig.url}/search`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${siteConfig.url}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${siteConfig.url}/contact`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${siteConfig.url}/editorial-policy`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${siteConfig.url}/ai-disclosure`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${siteConfig.url}/privacy-policy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${siteConfig.url}/terms`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  let postUrls: MetadataRoute.Sitemap = [];
  try {
    const allPosts = await db
      .select({
        slug: posts.slug,
        updatedAt: posts.updatedAt,
        publishedAt: posts.publishedAt,
        coverImageId: posts.coverImageId,
      })
      .from(posts)
      .where(eq(posts.status, "published"));

    postUrls = allPosts.map((p) => ({
      url: `${siteConfig.url}/blog/${p.slug}`,
      lastModified: p.updatedAt || p.publishedAt || new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
      images: p.coverImageId
        ? [`${siteConfig.url}/api/images/${p.coverImageId}`]
        : undefined,
    }));
  } catch (err) {
    console.warn(`[sitemap] Could not fetch posts: ${(err as Error).message}`);
  }

  let catUrls: MetadataRoute.Sitemap = [];
  try {
    const allCats = await db
      .select({ slug: categories.slug, createdAt: categories.createdAt })
      .from(categories);

    catUrls = allCats.map((c) => ({
      url: `${siteConfig.url}/category/${c.slug}`,
      lastModified: c.createdAt || new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    }));
  } catch (err) {
    console.warn(`[sitemap] Could not fetch categories: ${(err as Error).message}`);
  }

  let tagUrls: MetadataRoute.Sitemap = [];
  try {
    const allTags = await db.select({ slug: tags.slug }).from(tags);

    tagUrls = allTags.map((t) => ({
      url: `${siteConfig.url}/tag/${t.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.5,
    }));
  } catch (err) {
    console.warn(`[sitemap] Could not fetch tags: ${(err as Error).message}`);
  }

  return [...staticUrls, ...postUrls, ...catUrls, ...tagUrls];
}
