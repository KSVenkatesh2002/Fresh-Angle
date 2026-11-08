import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  uuid,
  index,
  uniqueIndex,
  primaryKey,
  customType,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Custom bytea type for storing binary image data safely
export const bytea = customType<{
  data: Buffer;
  driverData: Buffer | Uint8Array | string;
}>({
  dataType() {
    return "bytea";
  },
  toDriver(val: Buffer): Buffer {
    return val;
  },
  fromDriver(val: unknown): Buffer {
    if (Buffer.isBuffer(val)) return val;
    if (typeof val === "string") {
      const cleaned = val.startsWith("\\x") ? val.slice(2) : val;
      return Buffer.from(cleaned, "hex");
    }
    if (val instanceof Uint8Array) return Buffer.from(val);
    return Buffer.from(val as string);
  },
});

// Post Images table (supports Cloudinary storage with backward-compatible legacy bytea)
export const postImages = pgTable("post_images", {
  id: uuid("id").defaultRandom().primaryKey(),
  data: bytea("data"), // Nullable: new images store directly to Cloudinary without DB bloat
  mime: text("mime").notNull().default("image/webp"),
  width: integer("width").notNull().default(1200),
  height: integer("height").notNull().default(630),
  storageKey: text("storage_key"),
  publicUrl: text("public_url"),
  bytes: integer("bytes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Image Migrations tracking table for zero-loss Cloudinary migration
export const imageMigrations = pgTable("image_migrations", {
  id: uuid("id").defaultRandom().primaryKey(),
  imageId: uuid("image_id")
    .notNull()
    .references(() => postImages.id, { onDelete: "cascade" }),
  postId: uuid("post_id"),
  oldBytes: integer("old_bytes"),
  newBytes: integer("new_bytes"),
  publicUrl: text("public_url"),
  storageKey: text("storage_key"),
  bytes: integer("bytes"),
  status: text("status").notNull().default("pending"), // pending | verified | failed
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
});

// Categories table
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    introText: text("intro_text"),
    code: text("code").$type<string>(),
    featuredPostId: uuid("featured_post_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("categories_slug_idx").on(table.slug)],
);

// Tags table
export const tags = pgTable(
  "tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("tags_slug_idx").on(table.slug)],
);

// Posts table
export const posts = pgTable(
  "posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    excerpt: text("excerpt").notNull(),
    contentMd: text("content_md").notNull(),
    metaTitle: text("meta_title").notNull(),
    metaDescription: text("meta_description").notNull(),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    status: text("status")
      .$type<"draft" | "scheduled" | "published" | "archived">()
      .notNull()
      .default("draft"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    coverImageId: uuid("cover_image_id").references(() => postImages.id, {
      onDelete: "set null",
    }),
    coverImageUrl: text("cover_image_url"),
    coverAlt: text("cover_alt").notNull().default(""),
    coverCredit: text("cover_credit"),
    coverSource: text("cover_source")
      .$type<"ai" | "pexels" | "default">()
      .notNull()
      .default("default"),
    readingTimeMin: integer("reading_time_min").notNull().default(1),
    wordCount: integer("word_count").notNull().default(0),
    seoScore: integer("seo_score").notNull().default(0),
    origin: text("origin")
      .$type<"auto" | "manual" | "queue" | "test">()
      .notNull()
      .default("auto"),
    isIndexed: boolean("is_indexed").notNull().default(false),
    aiProvider: text("ai_provider").notNull(),
    aiModel: text("ai_model").notNull(),
    topicKey: text("topic_key").notNull(),
    entityKey: text("entity_key"),
    contentSimhash: text("content_simhash"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("posts_slug_idx").on(table.slug),
    index("posts_status_published_at_idx").on(table.status, table.publishedAt),
    index("posts_topic_key_idx").on(table.topicKey),
    index("posts_category_id_idx").on(table.categoryId),
    index("posts_scheduled_for_idx").on(table.scheduledFor),
  ],
);

// Post Tags join table
export const postTags = pgTable(
  "post_tags",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.tagId] }),
    index("post_tags_post_id_idx").on(table.postId),
    index("post_tags_tag_id_idx").on(table.tagId),
  ],
);

// Post Sources table
export const postSources = pgTable(
  "post_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    title: text("title").notNull(),
    publisher: text("publisher").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("post_sources_post_id_idx").on(table.postId),
    index("post_sources_url_idx").on(table.url),
  ],
);

// Pipeline Runs table
export interface PipelineStepRecord {
  step: string;
  status: "pending" | "success" | "failed" | "skipped";
  durationMs: number;
  details?: string;
}

export const pipelineRuns = pgTable(
  "pipeline_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    status: text("status").$type<"success" | "failed" | "partial">().notNull(),
    steps: jsonb("steps").$type<PipelineStepRecord[]>().notNull().default([]),
    providerUsed: text("provider_used"),
    error: text("error"),
    postId: uuid("post_id").references(() => posts.id, {
      onDelete: "set null",
    }),
  },
  (table) => [index("pipeline_runs_started_at_idx").on(table.startedAt)],
);

// Automation Settings (Single Row)
export const automationSettings = pgTable("automation_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  enabled: boolean("enabled").notNull().default(true),
  pausedUntil: timestamp("paused_until", { withTimezone: true }),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  mode: text("mode")
    .$type<"auto_distribute" | "fixed_times">()
    .notNull()
    .default("auto_distribute"),
  postsPerDay: integer("posts_per_day").notNull().default(2),
  windowStart: text("window_start").notNull().default("08:00"),
  windowEnd: text("window_end").notNull().default("22:00"),
  fixedTimes: jsonb("fixed_times")
    .$type<string[]>()
    .notNull()
    .default(["09:00", "18:00"]),
  weekdays: jsonb("weekdays")
    .$type<number[]>()
    .notNull()
    .default([0, 1, 2, 3, 4, 5, 6]),
  weekdayOverrides: jsonb("weekday_overrides")
    .$type<Record<string, number>>()
    .notNull()
    .default({}),
  jitterMinutes: integer("jitter_minutes").notNull().default(15),
  publishMode: text("publish_mode")
    .$type<"auto" | "review">()
    .notNull()
    .default("auto"),
  contentMode: text("content_mode")
    .$type<"trending" | "evergreen" | "queue_only" | "mixed">()
    .notNull()
    .default("trending"),
  categoryWeights: jsonb("category_weights")
    .$type<Record<string, number>>()
    .notNull()
    .default({}),
  includeTags: jsonb("include_tags").$type<string[]>().notNull().default([]),
  excludeTags: jsonb("exclude_tags").$type<string[]>().notNull().default([]),
  includeKeywords: jsonb("include_keywords")
    .$type<string[]>()
    .notNull()
    .default([]),
  excludeKeywords: jsonb("exclude_keywords")
    .$type<string[]>()
    .notNull()
    .default([]),
  minWords: integer("min_words").notNull().default(700),
  targetLength: text("target_length")
    .$type<"short" | "medium" | "long">()
    .notNull()
    .default("medium"),
  imageMode: text("image_mode")
    .$type<"ai" | "pexels" | "default">()
    .notNull()
    .default("ai"),
  maxPostsPerRun: integer("max_posts_per_run").notNull().default(2),
  lateSlotGraceMinutes: integer("late_slot_grace_minutes")
    .notNull()
    .default(360),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Date Overrides table (Holidays, campaigns)
export const dateOverrides = pgTable("date_overrides", {
  id: uuid("id").defaultRandom().primaryKey(),
  date: text("date").notNull().unique(), // YYYY-MM-DD
  enabled: boolean("enabled").notNull().default(true),
  postsCount: integer("posts_count"),
  fixedTimes: jsonb("fixed_times").$type<string[]>(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Post Slots table
export const postSlots = pgTable(
  "post_slots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    plannedAt: timestamp("planned_at", { withTimezone: true }).notNull(),
    status: text("status")
      .$type<"planned" | "running" | "done" | "skipped" | "missed" | "failed">()
      .notNull()
      .default("planned"),
    origin: text("origin")
      .$type<"auto" | "manual" | "queue" | "test">()
      .notNull()
      .default("auto"),
    slotCode: text("slot_code"),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    queueId: uuid("queue_id"),
    postId: uuid("post_id").references(() => posts.id, {
      onDelete: "set null",
    }),
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("post_slots_planned_at_status_idx").on(table.plannedAt, table.status),
  ],
);

// Topic Queue table
export const topicQueue = pgTable(
  "topic_queue",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    prompt: text("prompt"),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    sourceUrls: jsonb("source_urls").$type<string[]>().notNull().default([]),
    tone: text("tone").notNull().default("authoritative"),
    length: text("length")
      .$type<"short" | "medium" | "long">()
      .notNull()
      .default("medium"),
    imageMode: text("image_mode")
      .$type<"ai" | "pexels" | "default">()
      .notNull()
      .default("ai"),
    priority: integer("priority").notNull().default(0),
    publishAt: timestamp("publish_at", { withTimezone: true }),
    generateAt: timestamp("generate_at", { withTimezone: true }),
    status: text("status")
      .$type<"queued" | "generating" | "done" | "failed" | "cancelled">()
      .notNull()
      .default("queued"),
    postId: uuid("post_id").references(() => posts.id, {
      onDelete: "set null",
    }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("topic_queue_status_priority_idx").on(table.status, table.priority),
  ],
);

// Feeds table
export const slotEvents = pgTable(
  "slot_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slotId: uuid("slot_id")
      .references(() => postSlots.id, { onDelete: "cascade" })
      .notNull(),
    eventType: text("event_type")
      .$type<
        | "created"
        | "claimed"
        | "topic_assigned"
        | "generation_started"
        | "generation_completed"
        | "published"
        | "missed"
        | "skipped"
        | "failed"
        | "rescheduled"
      >()
      .notNull(),
    details: jsonb("details"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("slot_events_slot_id_idx").on(table.slotId),
    index("slot_events_created_at_idx").on(table.createdAt),
  ],
);

// Feeds table
export const feeds = pgTable(
  "feeds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    url: text("url").notNull().unique(),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    lastFetchAt: timestamp("last_fetch_at", { withTimezone: true }),
    lastStatus: text("last_status"),
    itemCount: integer("item_count").notNull().default(0),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("feeds_url_idx").on(table.url)],
);

// Usage Daily table
export const usageDaily = pgTable(
  "usage_daily",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    date: text("date").notNull(), // YYYY-MM-DD
    provider: text("provider").notNull(),
    kind: text("kind")
      .$type<"text" | "image" | "embedding" | "news">()
      .notNull(),
    calls: integer("calls").notNull().default(0),
    tokensIn: integer("tokens_in").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
    images: integer("images").notNull().default(0),
    errors: integer("errors").notNull().default(0),
  },
  (table) => [
    uniqueIndex("usage_daily_date_provider_kind_idx").on(
      table.date,
      table.provider,
      table.kind,
    ),
  ],
);

// Usage Limits table
export const usageLimits = pgTable(
  "usage_limits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: text("provider").notNull(),
    kind: text("kind")
      .$type<"text" | "image" | "embedding" | "news">()
      .notNull(),
    dailyLimit: integer("daily_limit").notNull().default(100),
    monthlyLimit: integer("monthly_limit").notNull().default(3000),
    softPercent: integer("soft_percent").notNull().default(80),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("usage_limits_provider_kind_idx").on(
      table.provider,
      table.kind,
    ),
  ],
);

// Seen Items table
export const seenItems = pgTable(
  "seen_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    url: text("url").notNull(),
    title: text("title").notNull(),
    verdict: text("verdict").$type<"approved" | "rejected">().notNull(),
    reason: text("reason"),
    seenAt: timestamp("seen_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("seen_items_url_idx").on(table.url),
    index("seen_items_seen_at_idx").on(table.seenAt),
  ],
);

// Post Links table (Internal link graph)
export const postLinks = pgTable(
  "post_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fromPostId: uuid("from_post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    toPostId: uuid("to_post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    anchor: text("anchor").notNull(),
    type: text("type").$type<"auto" | "manual">().notNull().default("auto"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("post_links_from_idx").on(table.fromPostId),
    index("post_links_to_idx").on(table.toPostId),
  ],
);

// Post Revisions table
export const postRevisions = pgTable(
  "post_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    contentMd: text("content_md").notNull(),
    excerpt: text("excerpt").notNull(),
    metaTitle: text("meta_title").notNull(),
    metaDescription: text("meta_description").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("post_revisions_post_id_idx").on(table.postId)],
);

// Redirects table
export const redirects = pgTable(
  "redirects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fromPath: text("from_path").notNull().unique(),
    toPath: text("to_path").notNull(),
    statusCode: integer("status_code").notNull().default(301),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("redirects_from_path_idx").on(table.fromPath)],
);

// Prompt Templates table
export const promptTemplates = pgTable(
  "prompt_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(), // 'outline' | 'draft' | 'review'
    version: text("version").notNull(),
    systemPrompt: text("system_prompt").notNull(),
    userPrompt: text("user_prompt").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("prompt_templates_name_idx").on(table.name)],
);

// Blocklist Terms table
export const blocklistTerms = pgTable(
  "blocklist_terms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    term: text("term").notNull().unique(),
    type: text("type").$type<"block" | "allow">().notNull().default("block"),
    category: text("category"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("blocklist_terms_term_idx").on(table.term)],
);

// Contact Messages table
export const contactMessages = pgTable(
  "contact_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    status: text("status")
      .$type<"new" | "read" | "replied" | "spam">()
      .notNull()
      .default("new"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("contact_messages_status_idx").on(table.status)],
);

// Post Feedback table
export const postFeedback = pgTable(
  "post_feedback",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    wasHelpful: boolean("was_helpful").notNull(),
    feedbackText: text("feedback_text"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("post_feedback_post_id_idx").on(table.postId)],
);

// Post Views Daily table
export const postViewsDaily = pgTable(
  "post_views_daily",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // YYYY-MM-DD
    views: integer("views").notNull().default(1),
  },
  (table) => [
    uniqueIndex("post_views_daily_post_date_idx").on(table.postId, table.date),
  ],
);

// Newsletter Subscribers table
export const newsletterSubscribers = pgTable(
  "newsletter_subscribers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull().unique(),
    status: text("status")
      .$type<"pending" | "active" | "unsubscribed">()
      .notNull()
      .default("pending"),
    token: text("token"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("newsletter_subscribers_email_idx").on(table.email)],
);

// Audit Log table
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    details: jsonb("details"),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("audit_log_created_at_idx").on(table.createdAt)],
);

// Key-Value Settings table
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Table Relations
export const postsRelations = relations(posts, ({ one, many }) => ({
  category: one(categories, {
    fields: [posts.categoryId],
    references: [categories.id],
  }),
  coverImage: one(postImages, {
    fields: [posts.coverImageId],
    references: [postImages.id],
  }),
  tags: many(postTags),
  sources: many(postSources),
  runs: many(pipelineRuns),
  inboundLinks: many(postLinks, { relationName: "inbound" }),
  outboundLinks: many(postLinks, { relationName: "outbound" }),
  revisions: many(postRevisions),
  feedback: many(postFeedback),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  posts: many(posts),
  feeds: many(feeds),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  posts: many(postTags),
}));

export const postTagsRelations = relations(postTags, ({ one }) => ({
  post: one(posts, {
    fields: [postTags.postId],
    references: [posts.id],
  }),
  tag: one(tags, {
    fields: [postTags.tagId],
    references: [tags.id],
  }),
}));

export const postSourcesRelations = relations(postSources, ({ one }) => ({
  post: one(posts, {
    fields: [postSources.postId],
    references: [posts.id],
  }),
}));

export const postLinksRelations = relations(postLinks, ({ one }) => ({
  fromPost: one(posts, {
    fields: [postLinks.fromPostId],
    references: [posts.id],
    relationName: "outbound",
  }),
  toPost: one(posts, {
    fields: [postLinks.toPostId],
    references: [posts.id],
    relationName: "inbound",
  }),
}));

export const postRevisionsRelations = relations(postRevisions, ({ one }) => ({
  post: one(posts, {
    fields: [postRevisions.postId],
    references: [posts.id],
  }),
}));

export const postFeedbackRelations = relations(postFeedback, ({ one }) => ({
  post: one(posts, {
    fields: [postFeedback.postId],
    references: [posts.id],
  }),
}));

export const postSlotsRelations = relations(postSlots, ({ one }) => ({
  category: one(categories, {
    fields: [postSlots.categoryId],
    references: [categories.id],
  }),
  post: one(posts, {
    fields: [postSlots.postId],
    references: [posts.id],
  }),
}));

export const topicQueueRelations = relations(topicQueue, ({ one }) => ({
  category: one(categories, {
    fields: [topicQueue.categoryId],
    references: [categories.id],
  }),
  post: one(posts, {
    fields: [topicQueue.postId],
    references: [posts.id],
  }),
}));

export const feedsRelations = relations(feeds, ({ one }) => ({
  category: one(categories, {
    fields: [feeds.categoryId],
    references: [categories.id],
  }),
}));

export const pipelineRunsRelations = relations(pipelineRuns, ({ one }) => ({
  post: one(posts, {
    fields: [pipelineRuns.postId],
    references: [posts.id],
  }),
}));

// Export inferred types
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type PostSource = typeof postSources.$inferSelect;
export type NewPostSource = typeof postSources.$inferInsert;
export type PostImage = typeof postImages.$inferSelect;
export type NewPostImage = typeof postImages.$inferInsert;
export type ImageMigration = typeof imageMigrations.$inferSelect;
export type NewImageMigration = typeof imageMigrations.$inferInsert;
export type PipelineRun = typeof pipelineRuns.$inferSelect;
export type NewPipelineRun = typeof pipelineRuns.$inferInsert;

export type AutomationSettings = typeof automationSettings.$inferSelect;
export type NewAutomationSettings = typeof automationSettings.$inferInsert;
export type DateOverride = typeof dateOverrides.$inferSelect;
export type NewDateOverride = typeof dateOverrides.$inferInsert;
export type PostSlot = typeof postSlots.$inferSelect;
export type NewPostSlot = typeof postSlots.$inferInsert;
export type SlotEvent = typeof slotEvents.$inferSelect;
export type NewSlotEvent = typeof slotEvents.$inferInsert;
export type TopicQueueItem = typeof topicQueue.$inferSelect;
export type TopicQueue = TopicQueueItem;
export type NewTopicQueueItem = typeof topicQueue.$inferInsert;
export type FeedRecord = typeof feeds.$inferSelect;
export type NewFeedRecord = typeof feeds.$inferInsert;
export type UsageDaily = typeof usageDaily.$inferSelect;
export type NewUsageDaily = typeof usageDaily.$inferInsert;
export type UsageLimit = typeof usageLimits.$inferSelect;
export type NewUsageLimit = typeof usageLimits.$inferInsert;
export type SeenItem = typeof seenItems.$inferSelect;
export type NewSeenItem = typeof seenItems.$inferInsert;
export type PostLink = typeof postLinks.$inferSelect;
export type NewPostLink = typeof postLinks.$inferInsert;
export type PostRevision = typeof postRevisions.$inferSelect;
export type NewPostRevision = typeof postRevisions.$inferInsert;
export type Redirect = typeof redirects.$inferSelect;
export type NewRedirect = typeof redirects.$inferInsert;
export type PromptTemplate = typeof promptTemplates.$inferSelect;
export type NewPromptTemplate = typeof promptTemplates.$inferInsert;
export type BlocklistTerm = typeof blocklistTerms.$inferSelect;
export type NewBlocklistTerm = typeof blocklistTerms.$inferInsert;
export type ContactMessage = typeof contactMessages.$inferSelect;
export type NewContactMessage = typeof contactMessages.$inferInsert;
export type PostFeedback = typeof postFeedback.$inferSelect;
export type NewPostFeedback = typeof postFeedback.$inferInsert;
export type PostViewDaily = typeof postViewsDaily.$inferSelect;
export type NewPostViewDaily = typeof postViewsDaily.$inferInsert;
export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;
export type NewNewsletterSubscriber = typeof newsletterSubscribers.$inferInsert;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;
export type SettingRecord = typeof settings.$inferSelect;
export type NewSettingRecord = typeof settings.$inferInsert;
