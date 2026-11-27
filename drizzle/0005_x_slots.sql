-- Phase 3 migration: Add x_slots table for independent extra X promotional posts
CREATE TABLE IF NOT EXISTS "x_slots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "planned_at" timestamp with time zone NOT NULL,
  "status" text DEFAULT 'planned' NOT NULL,
  "post_id" uuid REFERENCES "public"."posts"("id") ON DELETE SET NULL,
  "x_post_id" text,
  "error" text,
  "attempts" integer DEFAULT 0 NOT NULL,
  "started_at" timestamp with time zone,
  "finished_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "x_slots_planned_at_status_idx" ON "x_slots" USING btree ("planned_at", "status");

