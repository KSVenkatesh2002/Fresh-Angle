import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import fs from "fs";
import path from "path";
import { getDb } from "../src/db/client";
import { posts, postSources, postLinks, postTags } from "../src/db/schema";

async function main() {
  console.log("📦 Starting database export and backup...\n");
  const db = getDb();

  const allPosts = await db.select().from(posts);
  const allSources = await db.select().from(postSources);
  const allLinks = await db.select().from(postLinks);
  const allPostTags = await db.select().from(postTags);

  const backupDir = path.join(process.cwd(), "backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFile = path.join(backupDir, `backup-${timestamp}.json`);

  const payload = {
    exportedAt: new Date().toISOString(),
    counts: {
      posts: allPosts.length,
      postSources: allSources.length,
      postLinks: allLinks.length,
      postTags: allPostTags.length,
    },
    tables: {
      posts: allPosts,
      postSources: allSources,
      postLinks: allLinks,
      postTags: allPostTags,
    },
  };

  fs.writeFileSync(backupFile, JSON.stringify(payload, null, 2), "utf-8");

  console.log(`✅ Backup successfully saved to: ${backupFile}`);
  console.log(`   * Posts: ${allPosts.length}`);
  console.log(`   * Post Sources: ${allSources.length}`);
  console.log(`   * Post Links: ${allLinks.length}`);
  console.log(`   * Post Tags: ${allPostTags.length}\n`);

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Fatal error during backup:", err);
  process.exit(1);
});
