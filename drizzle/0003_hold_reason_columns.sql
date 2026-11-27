-- Phase 1 migration: Add hold_reason and hold_detail columns on posts (existing drafts stay null)
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "hold_reason" text;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "hold_detail" text;

