/**
 * Cloudinary Image Migration Script
 *
 * Migrates existing blog cover images from PostgreSQL bytea to Cloudinary.
 * Features:
 * - Batched, resumable, idempotent (skips already migrated rows)
 * - Deterministic public_id naming
 * - Verifies HTTP 200 + Content-Type after upload
 * - Updates post_images and posts.cover_image_url
 * - Records audit trail in image_migrations table
 * - Optional --purge-db-bytes (requires CONFIRM_PURGE=yes)
 *
 * Usage:
 *   # Migrate 1 image first to test:
 *   NODE_OPTIONS="--dns-result-order=ipv4first" pnpm tsx --env-file=.env scripts/migrate-images.ts --limit=1
 *
 *   # Migrate all remaining images:
 *   NODE_OPTIONS="--dns-result-order=ipv4first" pnpm tsx --env-file=.env scripts/migrate-images.ts
 *
 *   # Optional purge of bytea only after verification:
 *   CONFIRM_PURGE=yes NODE_OPTIONS="--dns-result-order=ipv4first" pnpm tsx --env-file=.env scripts/migrate-images.ts --purge-db-bytes
 */

import { neon } from "@neondatabase/serverless";
import { getImageStorage } from "../src/services/storage/cloudinary";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("❌ DATABASE_URL environment variable is required.");
  process.exit(1);
}

const sql = neon(databaseUrl);

// Parse CLI flags
const args = process.argv.slice(2);
const isPurgeMode = args.includes("--purge-db-bytes");
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : null;
const batchSizeArg = args.find((a) => a.startsWith("--batch-size="));
const batchSize = batchSizeArg ? parseInt(batchSizeArg.split("=")[1], 10) : 5;

async function purgeVerifiedBytes(): Promise<void> {
  console.log("🔒 [Purge Mode] Initiating database bytea purge for verified images...");

  if (process.env.CONFIRM_PURGE !== "yes") {
    console.error(
      "❌ Safety abort: --purge-db-bytes requires CONFIRM_PURGE=yes in environment.",
    );
    process.exit(1);
  }

  // Count eligible rows
  const eligible = await sql`
    SELECT COUNT(*)::int as count, COALESCE(SUM(octet_length(data))::int, 0) as total_bytes
    FROM post_images
    WHERE data IS NOT NULL
      AND id IN (SELECT image_id FROM image_migrations WHERE status = 'verified');
  `;

  const count = eligible[0]?.count || 0;
  const totalBytes = eligible[0]?.total_bytes || 0;

  if (count === 0) {
    console.log("ℹ️ No verified images with bytea data found to purge.");
    return;
  }

  console.log(
    `⚠️ Purging data column for ${count} verified images (reclaiming ~${Math.round(totalBytes / 1024)} KB)...`,
  );

  const result = await sql`
    UPDATE post_images
    SET data = NULL
    WHERE data IS NOT NULL
      AND id IN (SELECT image_id FROM image_migrations WHERE status = 'verified')
    RETURNING id;
  `;

  console.log(
    `✅ Successfully purged bytea data for ${result.length} images. Database storage reclaimed!`,
  );
}

async function verifyCloudinaryUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const contentType = res.headers.get("content-type") || "";
      return contentType.startsWith("image/");
    }
    return false;
  } catch {
    return false;
  }
}

async function runMigration(): Promise<void> {
  if (isPurgeMode) {
    await purgeVerifiedBytes();
    return;
  }

  console.log("🚀 Starting Cloudinary Image Migration...");

  // 1. Check total unmigrated rows
  const unmigratedCountRes = await sql`
    SELECT COUNT(*)::int as count, COALESCE(SUM(octet_length(data))::int, 0) as total_bytes
    FROM post_images
    WHERE public_url IS NULL AND data IS NOT NULL;
  `;

  const totalUnmigrated = unmigratedCountRes[0]?.count || 0;
  const totalBytesToMigrate = unmigratedCountRes[0]?.total_bytes || 0;

  console.log(
    `📊 Found ${totalUnmigrated} unmigrated images (~${Math.round(totalBytesToMigrate / 1024)} KB).`,
  );

  if (totalUnmigrated === 0) {
    console.log("✅ All images are already migrated to Cloudinary!");
    return;
  }

  const effectiveLimit = limit ? Math.min(limit, totalUnmigrated) : totalUnmigrated;
  console.log(`🎯 Target migration count for this run: ${effectiveLimit}`);

  const storage = getImageStorage();
  let migratedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let totalBytesUploaded = 0;

  // Process in batches
  while (migratedCount + skippedCount + failedCount < effectiveLimit) {
    const remainingToFetch = effectiveLimit - (migratedCount + skippedCount + failedCount);
    const currentBatchLimit = Math.min(batchSize, remainingToFetch);

    // Fetch batch with data and associated post
    const rows = await sql`
      SELECT
        pi.id as image_id,
        pi.data as image_data,
        octet_length(pi.data)::int as image_bytes,
        pi.mime,
        pi.width,
        pi.height,
        p.id as post_id,
        p.slug as post_slug,
        p.cover_alt as post_alt
      FROM post_images pi
      LEFT JOIN posts p ON p.cover_image_id = pi.id
      WHERE pi.public_url IS NULL AND pi.data IS NOT NULL
      ORDER BY pi.created_at ASC
      LIMIT ${currentBatchLimit};
    `;

    if (rows.length === 0) break;

    for (const row of rows) {
      const imageId = row.image_id;
      const buffer = Buffer.isBuffer(row.image_data)
        ? row.image_data
        : Buffer.from(row.image_data);
      const slug = row.post_slug || `legacy-${imageId.slice(0, 8)}`;
      const altText = row.post_alt || `Cover image for ${slug}`;
      const oldBytes = row.image_bytes || buffer.length;

      console.log(
        `\n[${migratedCount + 1}/${effectiveLimit}] Migrating image ${imageId} (${slug})...`,
      );

      try {
        // Upload to Cloudinary
        const uploadResult = await storage.put(buffer, {
          slug,
          altText,
          width: row.width || 1200,
          height: row.height || 630,
        });

        // Verify HTTP HEAD response
        const isValid = await verifyCloudinaryUrl(uploadResult.publicUrl);
        if (!isValid) {
          throw new Error(
            `Verification failed: ${uploadResult.publicUrl} did not return HTTP 200 image/*`,
          );
        }

        // Update post_images (additive - keep data intact for now)
        await sql`
          UPDATE post_images
          SET
            public_url = ${uploadResult.publicUrl},
            storage_key = ${uploadResult.storageKey},
            bytes = ${uploadResult.bytes}
          WHERE id = ${imageId};
        `;

        // Update posts.cover_image_url
        if (row.post_id) {
          await sql`
            UPDATE posts
            SET cover_image_url = ${uploadResult.publicUrl}
            WHERE id = ${row.post_id};
          `;
        }

        // Record verification in image_migrations
        await sql`
          INSERT INTO image_migrations (
            image_id,
            post_id,
            old_bytes,
            new_bytes,
            storage_key,
            public_url,
            status,
            verified_at
          ) VALUES (
            ${imageId},
            ${row.post_id || null},
            ${oldBytes},
            ${uploadResult.bytes},
            ${uploadResult.storageKey},
            ${uploadResult.publicUrl},
            'verified',
            NOW()
          );
        `;

        migratedCount++;
        totalBytesUploaded += uploadResult.bytes;
        console.log(`  ✓ Verified & saved: ${uploadResult.publicUrl}`);
      } catch (err: unknown) {
        failedCount++;
        const errMsg = (err as Error).message;
        console.error(`  ❌ Failed migrating image ${imageId}:`, errMsg);

        // Record failed attempt
        await sql`
          INSERT INTO image_migrations (
            image_id,
            post_id,
            old_bytes,
            status,
            error
          ) VALUES (
            ${imageId},
            ${row.post_id || null},
            ${oldBytes},
            'failed',
            ${errMsg}
          );
        `;
      }
    }

    console.log(
      `--- Batch Progress: Migrated: ${migratedCount}, Failed: ${failedCount}, Bytes Uploaded: ~${Math.round(totalBytesUploaded / 1024)} KB ---`,
    );
  }

  console.log("\n================ MIGRATION REPORT ================");
  console.log(`Total Target:    ${effectiveLimit}`);
  console.log(`Migrated:        ${migratedCount}`);
  console.log(`Failed:          ${failedCount}`);
  console.log(`Bytes Uploaded:  ~${Math.round(totalBytesUploaded / 1024)} KB`);
  console.log("=================================================");
}

runMigration().catch((err) => {
  console.error("Migration failed with fatal error:", err);
  process.exit(1);
});

