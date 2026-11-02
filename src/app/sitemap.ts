import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { getDb } from "@/db/client";
import { posts, categories, tags } from "@/db/schema";
import { eq } from "drizzle-orm";

export const revalidate = 3600;

export async function generateSitemaps(): Promise<Array<{ id: string }>> {
  return [
    { id: "posts" },
    { id: "categories" },
    { id: "tags" },
    { id: "static" },
  ];
}

export default async function sitemap({
  id,
}: {
  id?: string;
}): Promise<MetadataRoute.Sitemap> {
  const db = getDb();

  if (id === "posts") {
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

      return allPosts.map((p) => ({
        url: `${siteConfig.url}/blog/${p.slug}`,
        lastModified: p.updatedAt || p.publishedAt || new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.8,
        images: p.coverImageId
          ? [`${siteConfig.url}/api/images/${p.coverImageId}`]
          : undefined,
      }));
    } catch {
      return [];
    }
  }

  if (id === "categories") {
    try {
      const allCats = await db
        .select({ slug: categories.slug, updatedAt: categories.createdAt })
        .from(categories);
      return allCats.map((c) => ({
        url: `${siteConfig.url}/category/${c.slug}`,
        lastModified: new Date(),
        changeFrequency: "daily" as const,
        priority: 0.7,
      }));
    } catch {
      return [];
    }
  }

  if (id === "tags") {
    try {
      const allTags = await db.select({ slug: tags.slug }).from(tags);
      return allTags.map((t) => ({
        url: `${siteConfig.url}/tag/${t.slug}`,
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.5,
      }));
    } catch {
      return [];
    }
  }

  // Static pages and fallback
  const staticUrls = [
    { url: siteConfig.url, changeFrequency: "daily" as const, priority: 1.0 },
    {
      url: `${siteConfig.url}/blog`,
      changeFrequency: "daily" as const,
      priority: 0.9,
    },
    {
      url: `${siteConfig.url}/categories`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    },
    {
      url: `${siteConfig.url}/tags`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    },
    {
      url: `${siteConfig.url}/archive`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    },
    {
      url: `${siteConfig.url}/search`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    },
    {
      url: `${siteConfig.url}/about`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    {
      url: `${siteConfig.url}/contact`,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    },
    {
      url: `${siteConfig.url}/editorial-policy`,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    },
    {
      url: `${siteConfig.url}/ai-disclosure`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
    {
      url: `${siteConfig.url}/privacy-policy`,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    },
    {
      url: `${siteConfig.url}/terms`,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    },
  ];

  return staticUrls.map((s) => ({
    ...s,
    lastModified: new Date(),
  }));
}
