import { NextResponse } from "next/server";
import { siteConfig } from "@/config/site";
import { getDb } from "@/db/client";
import { posts } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  let itemsXml = "";

  try {
    const db = getDb();
    const publishedPosts = await db.query.posts.findMany({
      where: eq(posts.status, "published"),
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
      <category><![CDATA[${post.category?.name || "Technology"}]]></category>
      <author><![CDATA[editorial@freshangle.ai (${siteConfig.author.name})]]></author>
    </item>`;
      })
      .join("\n");
  } catch (err) {
    console.warn(
      `⚠️ [RSS] Could not fetch posts for feed: ${(err as Error).message}`,
    );
  }

  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/feed.xsl"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title><![CDATA[${siteConfig.name} - ${siteConfig.tagline}]]></title>
    <link>${siteConfig.url}</link>
    <description><![CDATA[${siteConfig.description}]]></description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteConfig.url}/feed.xml" rel="self" type="application/rss+xml"/>
${itemsXml}
  </channel>
</rss>`;

  return new NextResponse(rssXml, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control":
        "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
