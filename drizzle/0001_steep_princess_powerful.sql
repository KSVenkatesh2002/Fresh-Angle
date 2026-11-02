CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"details" jsonb,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"paused_until" timestamp with time zone,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"mode" text DEFAULT 'auto_distribute' NOT NULL,
	"posts_per_day" integer DEFAULT 2 NOT NULL,
	"window_start" text DEFAULT '08:00' NOT NULL,
	"window_end" text DEFAULT '22:00' NOT NULL,
	"fixed_times" jsonb DEFAULT '["09:00","18:00"]'::jsonb NOT NULL,
	"weekdays" jsonb DEFAULT '[0,1,2,3,4,5,6]'::jsonb NOT NULL,
	"weekday_overrides" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"jitter_minutes" integer DEFAULT 15 NOT NULL,
	"publish_mode" text DEFAULT 'auto' NOT NULL,
	"content_mode" text DEFAULT 'trending' NOT NULL,
	"category_weights" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"include_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"exclude_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"include_keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"exclude_keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"min_words" integer DEFAULT 700 NOT NULL,
	"target_length" text DEFAULT 'medium' NOT NULL,
	"image_mode" text DEFAULT 'ai' NOT NULL,
	"max_posts_per_run" integer DEFAULT 1 NOT NULL,
	"late_slot_grace_minutes" integer DEFAULT 60 NOT NULL,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blocklist_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"term" text NOT NULL,
	"type" text DEFAULT 'block' NOT NULL,
	"category" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blocklist_terms_term_unique" UNIQUE("term")
);
--> statement-breakpoint
CREATE TABLE "contact_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "date_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"posts_count" integer,
	"fixed_times" jsonb,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "date_overrides_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "feeds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"category_id" uuid,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_fetch_at" timestamp with time zone,
	"last_status" text,
	"item_count" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feeds_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "newsletter_subscribers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "newsletter_subscribers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "post_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"was_helpful" boolean NOT NULL,
	"feedback_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_post_id" uuid NOT NULL,
	"to_post_id" uuid NOT NULL,
	"anchor" text NOT NULL,
	"type" text DEFAULT 'auto' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"title" text NOT NULL,
	"content_md" text NOT NULL,
	"excerpt" text NOT NULL,
	"meta_title" text NOT NULL,
	"meta_description" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planned_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"origin" text DEFAULT 'auto' NOT NULL,
	"category_id" uuid,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"queue_id" uuid,
	"post_id" uuid,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_views_daily" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"date" text NOT NULL,
	"views" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompt_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"version" text NOT NULL,
	"system_prompt" text NOT NULL,
	"user_prompt" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "redirects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_path" text NOT NULL,
	"to_path" text NOT NULL,
	"status_code" integer DEFAULT 301 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "redirects_from_path_unique" UNIQUE("from_path")
);
--> statement-breakpoint
CREATE TABLE "seen_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"verdict" text NOT NULL,
	"reason" text,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topic_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"prompt" text,
	"category_id" uuid,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tone" text DEFAULT 'authoritative' NOT NULL,
	"length" text DEFAULT 'medium' NOT NULL,
	"image_mode" text DEFAULT 'ai' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"publish_at" timestamp with time zone,
	"generate_at" timestamp with time zone,
	"status" text DEFAULT 'queued' NOT NULL,
	"post_id" uuid,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_daily" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" text NOT NULL,
	"provider" text NOT NULL,
	"kind" text NOT NULL,
	"calls" integer DEFAULT 0 NOT NULL,
	"tokens_in" integer DEFAULT 0 NOT NULL,
	"tokens_out" integer DEFAULT 0 NOT NULL,
	"images" integer DEFAULT 0 NOT NULL,
	"errors" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"kind" text NOT NULL,
	"daily_limit" integer DEFAULT 100 NOT NULL,
	"monthly_limit" integer DEFAULT 3000 NOT NULL,
	"soft_percent" integer DEFAULT 80 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "intro_text" text;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "featured_post_id" uuid;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "scheduled_for" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "word_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "seo_score" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "origin" text DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "is_indexed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "entity_key" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "content_simhash" text;--> statement-breakpoint
ALTER TABLE "feeds" ADD CONSTRAINT "feeds_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_feedback" ADD CONSTRAINT "post_feedback_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_links" ADD CONSTRAINT "post_links_from_post_id_posts_id_fk" FOREIGN KEY ("from_post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_links" ADD CONSTRAINT "post_links_to_post_id_posts_id_fk" FOREIGN KEY ("to_post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_revisions" ADD CONSTRAINT "post_revisions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_slots" ADD CONSTRAINT "post_slots_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_slots" ADD CONSTRAINT "post_slots_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_views_daily" ADD CONSTRAINT "post_views_daily_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_queue" ADD CONSTRAINT "topic_queue_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_queue" ADD CONSTRAINT "topic_queue_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "blocklist_terms_term_idx" ON "blocklist_terms" USING btree ("term");--> statement-breakpoint
CREATE INDEX "contact_messages_status_idx" ON "contact_messages" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "feeds_url_idx" ON "feeds" USING btree ("url");--> statement-breakpoint
CREATE UNIQUE INDEX "newsletter_subscribers_email_idx" ON "newsletter_subscribers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "post_feedback_post_id_idx" ON "post_feedback" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "post_links_from_idx" ON "post_links" USING btree ("from_post_id");--> statement-breakpoint
CREATE INDEX "post_links_to_idx" ON "post_links" USING btree ("to_post_id");--> statement-breakpoint
CREATE INDEX "post_revisions_post_id_idx" ON "post_revisions" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "post_slots_planned_at_status_idx" ON "post_slots" USING btree ("planned_at","status");--> statement-breakpoint
CREATE UNIQUE INDEX "post_views_daily_post_date_idx" ON "post_views_daily" USING btree ("post_id","date");--> statement-breakpoint
CREATE INDEX "prompt_templates_name_idx" ON "prompt_templates" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "redirects_from_path_idx" ON "redirects" USING btree ("from_path");--> statement-breakpoint
CREATE INDEX "seen_items_url_idx" ON "seen_items" USING btree ("url");--> statement-breakpoint
CREATE INDEX "seen_items_seen_at_idx" ON "seen_items" USING btree ("seen_at");--> statement-breakpoint
CREATE INDEX "topic_queue_status_priority_idx" ON "topic_queue" USING btree ("status","priority");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_daily_date_provider_kind_idx" ON "usage_daily" USING btree ("date","provider","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_limits_provider_kind_idx" ON "usage_limits" USING btree ("provider","kind");--> statement-breakpoint
CREATE INDEX "post_sources_url_idx" ON "post_sources" USING btree ("url");--> statement-breakpoint
CREATE INDEX "posts_scheduled_for_idx" ON "posts" USING btree ("scheduled_for");