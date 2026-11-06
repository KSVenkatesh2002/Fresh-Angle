import { NextResponse, type NextRequest } from "next/server";
import { siteConfig } from "@/config/site";
import { getDb } from "@/db/client";
import { posts, categories } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await context.params;
  let itemsXml = "";
  let categoryName = "All Categories";

  try {
    const db = getDb();
    const category = await db.query.categories.findFirst({
      where: eq(categories.slug, slug),
    });

    if (!category) {
      return new Response("Category not found", { status: 404 });
    }

    categoryName = category.name;

    const publishedPosts = await db.query.posts.findMany({
      where: (p, { eq, and }) =>
        and(eq(p.status, "published"), eq(p.categoryId, category.id)),
      orderBy: [desc(posts.publishedAt)],
      limit: 25,
      with: {
        category: true,
      },
    });

    itemsXml = publishedPosts
      .map((post) => {
        const url = `${siteConfig.url}/blog/${post.slug}`;
        const pubDate = post.publishedAt
          ? new Date(post.publishedAt).toUTCString()
          : new Date().toUTCString();

        return `
    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description><![CDATA[${post.excerpt}]]></description>
      <pubDate>${pubDate}</pubDate>
      <category><![CDATA[${categoryName}]]></category>
      <author><![CDATA[editorial@freshangle.ai (${siteConfig.author.name})]]></author>
    </item>`;
      })
      .join("\n");
  } catch (err) {
    console.warn(
      `⚠️ [Category RSS] Could not fetch posts for category ${slug}: ${(err as Error).message}`,
    );
  }

  const feedUrl = `${siteConfig.url}/feed/category/${slug}`;
  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/feed.xsl"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title><![CDATA[${categoryName} - ${siteConfig.name} Feed]]></title>
    <link>${siteConfig.url}/category/${slug}</link>
    <description><![CDATA[Latest dispatches in ${categoryName} from ${siteConfig.name}]]></description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml"/>
${itemsXml}
  </channel>
</rss>`;

  return new NextResponse(rssXml.trim(), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control":
        "public, s-maxage=1800, stale-while-revalidate=86400, max-age=600",
    },
  });
}

