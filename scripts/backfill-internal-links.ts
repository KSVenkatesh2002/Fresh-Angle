import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import { getDb } from "../src/db/client";
import { posts, postLinks, postTags, tags, categories } from "../src/db/schema";
import { eq, inArray } from "drizzle-orm";
import {
  extractTargetKeywords,
  injectContextualInternalLinks,
  LinkTarget,
} from "../src/services/seo/internal-links";

async function main() {
  console.log("🚀 Starting Contextual Internal Linking Backfill for Fresh Angle...\n");
  const db = getDb();

  // 1. Fetch all published posts
  const publishedPosts = await db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      contentMd: posts.contentMd,
      categoryId: posts.categoryId,
    })
    .from(posts)
    .where(eq(posts.status, "published"));

  console.log(`Found ${publishedPosts.length} published posts in database.`);
  if (publishedPosts.length === 0) {
    console.log("No published posts to process.");
    process.exit(0);
  }

  // 2. Fetch tags for all published posts
  const postIds = publishedPosts.map((p) => p.id);
  const tagRows = await db
    .select({
      postId: postTags.postId,
      tagName: tags.name,
    })
    .from(postTags)
    .leftJoin(tags, eq(postTags.tagId, tags.id))
    .where(inArray(postTags.postId, postIds));

  const tagsByPostId = new Map<string, string[]>();
  for (const t of tagRows) {
    if (t.postId && t.tagName) {
      const list = tagsByPostId.get(t.postId) || [];
      list.push(t.tagName);
      tagsByPostId.set(t.postId, list);
    }
  }

  // 3. Build candidate targets for every post
  const targets: LinkTarget[] = publishedPosts.map((p) => {
    const postTagsList = tagsByPostId.get(p.id) || [];
    const keywords = extractTargetKeywords(p.title, postTagsList);
    return {
      id: p.id,
      title: p.title,
      slug: p.slug,
      tags: postTagsList,
      keywords,
    };
  });

  console.log(`Extracted keyword targets across all ${targets.length} articles.`);

  // 4. Clean out old automated links to prevent stale or duplicate links
  await db.delete(postLinks).where(eq(postLinks.type, "auto"));
  console.log("Cleared existing automated post_links.");

  // 5. Iterate through each post and inject contextual links
  let totalLinksInjected = 0;
  let postsUpdated = 0;

  for (const post of publishedPosts) {
    const result = injectContextualInternalLinks(
      post.contentMd,
      post.slug,
      targets,
      3, // inject 2-3 links per post
    );

    if (result.injectedLinks.length > 0) {
      // Update post markdown content
      await db
        .update(posts)
        .set({ contentMd: result.enrichedMd })
        .where(eq(posts.id, post.id));

      // Record in post_links
      const linkRows = result.injectedLinks.map((l) => ({
        fromPostId: post.id,
        toPostId: l.toPostId,
        anchor: l.anchor,
        type: "auto" as const,
      }));

      await db.insert(postLinks).values(linkRows);

      totalLinksInjected += linkRows.length;
      postsUpdated++;
      console.log(
        `✓ [${post.slug}] Injected ${linkRows.length} links: ${result.injectedLinks.map((l) => `"${l.anchor}" -> /blog/${l.targetSlug}`).join(", ")}`,
      );
    } else {
      console.log(`ℹ️ [${post.slug}] No contextual keyword match found.`);
    }
  }

  // 6. Verify link count
  const allLinksCount = await db.select().from(postLinks);
  console.log("\n=================================");
  console.log(`🎉 Backfill Complete!`);
  console.log(`Total Published Posts: ${publishedPosts.length}`);
  console.log(`Posts Updated with Contextual Links: ${postsUpdated}`);
  console.log(`Total Links Injected: ${totalLinksInjected}`);
  console.log(`Current Total Rows in post_links: ${allLinksCount.length}`);
  console.log("=================================\n");

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Fatal error during internal linking backfill:", err);
  process.exit(1);
});

