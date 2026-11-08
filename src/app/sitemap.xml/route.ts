import { NextResponse } from "next/server";
import { siteConfig } from "@/config/site";
import { getDb } from "@/db/client";
import { posts, categories, tags } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAbsoluteCoverImageUrl } from "@/lib/images/helpers";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const db = getDb();

  interface SitemapEntry {
    url: string;
    lastmod: string;
    changefreq: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
    priority: number;
    image?: string;
  }

  const nowIso = new Date().toISOString();

  const staticEntries: SitemapEntry[] = [
    { url: siteConfig.url, lastmod: nowIso, changefreq: "daily", priority: 1.0 },
    { url: `${siteConfig.url}/blog`, lastmod: nowIso, changefreq: "daily", priority: 0.9 },
    { url: `${siteConfig.url}/categories`, lastmod: nowIso, changefreq: "daily", priority: 0.8 },
    { url: `${siteConfig.url}/tags`, lastmod: nowIso, changefreq: "weekly", priority: 0.7 },
    { url: `${siteConfig.url}/archive`, lastmod: nowIso, changefreq: "weekly", priority: 0.7 },
    { url: `${siteConfig.url}/sitemap`, lastmod: nowIso, changefreq: "daily", priority: 0.8 },
    { url: `${siteConfig.url}/rss`, lastmod: nowIso, changefreq: "daily", priority: 0.7 },
    { url: `${siteConfig.url}/search`, lastmod: nowIso, changefreq: "weekly", priority: 0.6 },
    { url: `${siteConfig.url}/about`, lastmod: nowIso, changefreq: "monthly", priority: 0.7 },
    { url: `${siteConfig.url}/contact`, lastmod: nowIso, changefreq: "monthly", priority: 0.5 },
    { url: `${siteConfig.url}/editorial-policy`, lastmod: nowIso, changefreq: "monthly", priority: 0.5 },
    { url: `${siteConfig.url}/privacy-policy`, lastmod: nowIso, changefreq: "yearly", priority: 0.3 },
    { url: `${siteConfig.url}/terms`, lastmod: nowIso, changefreq: "yearly", priority: 0.3 },
  ];

  let postEntries: SitemapEntry[] = [];
  try {
    const allPosts = await db
      .select({
        slug: posts.slug,
        updatedAt: posts.updatedAt,
        publishedAt: posts.publishedAt,
        coverImageId: posts.coverImageId,
        coverImageUrl: posts.coverImageUrl,
      })
      .from(posts)
      .where(eq(posts.status, "published"));

    postEntries = allPosts.map((p) => ({
      url: `${siteConfig.url}/blog/${p.slug}`,
      lastmod: (p.updatedAt || p.publishedAt || new Date()).toISOString(),
      changefreq: "weekly",
      priority: 0.8,
      image: (p.coverImageUrl || p.coverImageId)
        ? getAbsoluteCoverImageUrl(
            { coverImageUrl: p.coverImageUrl, coverImageId: p.coverImageId },
            siteConfig.url,
          )
        : undefined,
    }));
  } catch (err) {
    console.warn(`[sitemap] Could not fetch posts: ${(err as Error).message}`);
  }

  let catEntries: SitemapEntry[] = [];
  try {
    const allCats = await db
      .select({ slug: categories.slug, createdAt: categories.createdAt })
      .from(categories);

    catEntries = allCats.map((c) => ({
      url: `${siteConfig.url}/category/${c.slug}`,
      lastmod: (c.createdAt || new Date()).toISOString(),
      changefreq: "daily",
      priority: 0.7,
    }));
  } catch (err) {
    console.warn(`[sitemap] Could not fetch categories: ${(err as Error).message}`);
  }

  let tagEntries: SitemapEntry[] = [];
  try {
    const allTags = await db.select({ slug: tags.slug }).from(tags);

    tagEntries = allTags.map((t) => ({
      url: `${siteConfig.url}/tag/${t.slug}`,
      lastmod: nowIso,
      changefreq: "weekly",
      priority: 0.5,
    }));
  } catch (err) {
    console.warn(`[sitemap] Could not fetch tags: ${(err as Error).message}`);
  }

  const allEntries = [...staticEntries, ...postEntries, ...catEntries, ...tagEntries];

  const xmlUrls = allEntries
    .map((e) => {
      const imageNode = e.image
        ? `\n    <image:image>\n      <image:loc>${e.image}</image:loc>\n    </image:image>`
        : "";
      return `  <url>
    <loc>${e.url}</loc>
    <lastmod>${e.lastmod}</lastmod>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority.toFixed(1)}</priority>${imageNode}
  </url>`;
    })
    .join("\n");

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${xmlUrls}
</urlset>`;

  return new NextResponse(sitemapXml.trim(), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

