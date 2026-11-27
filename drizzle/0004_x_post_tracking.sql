-- Phase 2 migration: Add X auto-posting columns on posts and mark legacy published posts skipped
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "x_post_status" text;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "x_post_id" text;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "x_posted_at" timestamp with time zone;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "x_post_error" text;

-- Ensure already-published articles are never retroactively posted to X
UPDATE "posts"
SET "x_post_status" = 'skipped',
    "x_post_error" = 'Backfilled prior to X auto-posting rollout'
WHERE "status" = 'published'
  AND "x_post_status" IS NULL;
