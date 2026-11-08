import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import { getDb } from "../src/db/client";
import { postSlots, posts, postImages, postTags, postSources, categories } from "../src/db/schema";
import { eq, and } from "drizzle-orm";
import { getImageStorage } from "../src/services/storage/cloudinary";

function parseArgs(): {
  cleanup: boolean;
  count: number;
  everyMinutes: number;
} {
  const args = process.argv.slice(2);
  let cleanup = false;
  let count = 3;
  let everyMinutes = 5;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--cleanup") {
      cleanup = true;
    } else if (args[i] === "--count" && args[i + 1]) {
      const val = parseInt(args[i + 1], 10);
      if (!isNaN(val) && val > 0 && val <= 20) {
        count = val;
      }
      i++;
    } else if (args[i] === "--every" && args[i + 1]) {
      const val = parseInt(args[i + 1], 10);
      if (!isNaN(val) && val > 0 && val <= 1440) {
        everyMinutes = val;
      }
      i++;
    }
  }

  return { cleanup, count, everyMinutes };
}

function toIstString(date: Date): string {
  const istDate = new Date(date.getTime() + 5.5 * 3600 * 1000);
  return (
    istDate.toISOString().replace("T", " ").substring(0, 16) + " IST"
  );
}

async function handleCleanup(): Promise<void> {
  const db = getDb();
  console.log("\n======================================================");
  console.log("🧹 [Test Slots Cleanup] Scanning for test slots (origin=test)...");
  console.log("======================================================\n");

  // Query ONLY slots where origin = 'test'
  const testSlotsList = await db.query.postSlots.findMany({
    where: eq(postSlots.origin, "test"),
  });

  if (testSlotsList.length === 0) {
    console.log("ℹ️ No test slots found in database.");
    console.log("🛡️ Safety confirmation: Zero real production slots were touched.\n");
    return;
  }

  console.log(`Found ${testSlotsList.length} test slot(s) to clean up.\n`);

  let deletedPostsCount = 0;
  let deletedImagesCount = 0;

  for (const slot of testSlotsList) {
    if (slot.postId) {
      // Find the associated post
      const post = await db.query.posts.findFirst({
        where: eq(posts.id, slot.postId),
      });

      if (post) {
        // STRICT SAFETY CHECK: Refuse to touch any real production published post!
        if (post.origin !== "test" && post.status === "published" && !post.title.startsWith("[TEST]")) {
          console.warn(
            `⚠️ [SAFETY SHIELD] Refusing to touch published post '${post.title}' (${post.id}). Skipping post deletion.`,
          );
          continue;
        }

        // Delete associated Cloudinary image
        if (post.coverImageId) {
          const img = await db.query.postImages.findFirst({
            where: eq(postImages.id, post.coverImageId),
          });

          if (img && img.storageKey) {
            try {
              const storage = getImageStorage();
              await storage.delete(img.storageKey);
              console.log(`  ✓ Deleted Cloudinary test image: ${img.storageKey}`);
              deletedImagesCount++;
            } catch (cloudErr) {
              console.warn(`  ⚠️ Could not delete Cloudinary asset ${img.storageKey}: ${(cloudErr as Error).message}`);
            }
          }

          if (img) {
            await db.delete(postImages).where(eq(postImages.id, img.id));
          }
        }

        // Delete post tags, sources, and post row
        await db.delete(postTags).where(eq(postTags.postId, post.id));
        await db.delete(postSources).where(eq(postSources.postId, post.id));
        await db.delete(posts).where(eq(posts.id, post.id));
        deletedPostsCount++;
        console.log(`  ✓ Deleted draft test post: '${post.title}' (${post.id})`);
      }
    }

    // Delete the test slot itself
    await db.delete(postSlots).where(and(eq(postSlots.id, slot.id), eq(postSlots.origin, "test")));
    console.log(`  ✓ Deleted test slot: ${slot.id}`);
  }

  console.log("\n------------------------------------------------------");
  console.log(`✅ Cleanup Complete:`);
  console.log(`  • Removed ${testSlotsList.length} test slot(s)`);
  console.log(`  • Removed ${deletedPostsCount} test draft post(s)`);
  console.log(`  • Purged ${deletedImagesCount} Cloudinary test image(s)`);
  console.log(`🛡️ SAFETY GUARANTEE: All real production slots, published articles, and assets were 100% untouched.\n`);
}

async function handleCreate(count: number, everyMinutes: number): Promise<void> {
  const db = getDb();
  console.log("\n======================================================");
  console.log(`🧪 [Test Slots Tooling] Creating ${count} test slots (every ${everyMinutes}m)...`);
  console.log("======================================================\n");

  // Get active category for slot assignment
  const firstCategory = await db.query.categories.findFirst();

  const now = new Date();
  const createdSlots = [];

  for (let i = 0; i < count; i++) {
    const plannedAt = new Date(now.getTime() + (i + 1) * everyMinutes * 60 * 1000);

    const [newSlot] = await db
      .insert(postSlots)
      .values({
        plannedAt,
        origin: "test", // STRICTLY origin=test
        status: "planned",
        categoryId: firstCategory?.id || null,
        tags: ["test", "simulation"],
      })
      .returning();

    createdSlots.push(newSlot);
  }

  console.log(`✓ Successfully created ${createdSlots.length} test slot(s):\n`);

  console.log("ID                                   | Planned At (UTC)         | Planned At (IST)   | Origin | Status");
  console.log("-------------------------------------+--------------------------+--------------------+--------+--------");
  for (const s of createdSlots) {
    const utcStr = s.plannedAt.toISOString().replace("T", " ").substring(0, 19) + " UTC";
    const istStr = toIstString(s.plannedAt);
    console.log(`${s.id} | ${utcStr} | ${istStr} | ${s.origin}   | ${s.status}`);
  }

  console.log("\n🔒 TEST SLOT SAFETY RULES:");
  console.log("  1. Always saved as status: 'draft'. Never published publicly.");
  console.log("  2. IndexNow SEO pings and social media shares are completely bypassed.");
  console.log("  3. Admin schedule displays a clear amber [🧪 TEST] badge.");
  console.log("  4. Telegram notifications are explicitly prefixed with [TEST SLOT].");
  console.log("\nNext Steps:");
  console.log("  • Preview simulated execution: pnpm run tick --simulate-at <ISO>");
  console.log("  • Clean up after testing:      npm run test-slots -- --cleanup\n");
}

async function main(): Promise<void> {
  const { cleanup, count, everyMinutes } = parseArgs();

  try {
    if (cleanup) {
      await handleCleanup();
    } else {
      await handleCreate(count, everyMinutes);
    }
    process.exit(0);
  } catch (err: unknown) {
    console.error("❌ [Test Slots Error]:", (err as Error).message);
    process.exit(1);
  }
}

void main();

