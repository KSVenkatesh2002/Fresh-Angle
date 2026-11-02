import {
  pgTable,
  text,
  integer,
  timestamp,
  uuid,
  index,
  uniqueIndex,
  primaryKey,
  customType,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Custom bytea type for storing binary image data safely
export const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array | string }>({
  dataType() {
    return 'bytea';
  },
  toDriver(val: Buffer): Buffer {
    return val;
  },
  fromDriver(val: unknown): Buffer {
    if (Buffer.isBuffer(val)) {
      return val;
    }
    if (typeof val === 'string') {
      // Handles hex-encoded bytea string (e.g. \x...)
      const cleaned = val.startsWith('\\x') ? val.slice(2) : val;
      return Buffer.from(cleaned, 'hex');
    }
    if (val instanceof Uint8Array) {
      return Buffer.from(val);
    }
    return Buffer.from(val as string);
  },
});

// Post Images table (stores WebP covers)
export const postImages = pgTable('post_images', {
  id: uuid('id').defaultRandom().primaryKey(),
  data: bytea('data').notNull(),
  mime: text('mime').notNull().default('image/webp'),
  width: integer('width').notNull().default(1200),
  height: integer('height').notNull().default(630),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Categories table
export const categories = pgTable(
  'categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('categories_slug_idx').on(table.slug)]
);

// Tags table
export const tags = pgTable(
  'tags',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('tags_slug_idx').on(table.slug)]
);

// Posts table
export const posts = pgTable(
  'posts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    excerpt: text('excerpt').notNull(),
    contentMd: text('content_md').notNull(),
    metaTitle: text('meta_title').notNull(),
    metaDescription: text('meta_description').notNull(),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
    status: text('status')
      .$type<'draft' | 'published' | 'archived'>()
      .notNull()
      .default('draft'),
    coverImageId: uuid('cover_image_id').references(() => postImages.id, {
      onDelete: 'set null',
    }),
    coverAlt: text('cover_alt').notNull().default(''),
    coverCredit: text('cover_credit'),
    coverSource: text('cover_source')
      .$type<'ai' | 'pexels' | 'default'>()
      .notNull()
      .default('default'),
    readingTimeMin: integer('reading_time_min').notNull().default(1),
    aiProvider: text('ai_provider').notNull(),
    aiModel: text('ai_model').notNull(),
    topicKey: text('topic_key').notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('posts_slug_idx').on(table.slug),
    index('posts_status_published_at_idx').on(table.status, table.publishedAt),
    index('posts_topic_key_idx').on(table.topicKey),
    index('posts_category_id_idx').on(table.categoryId),
  ]
);

// Post Tags join table
export const postTags = pgTable(
  'post_tags',
  {
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.tagId] }),
    index('post_tags_post_id_idx').on(table.postId),
    index('post_tags_tag_id_idx').on(table.tagId),
  ]
);

// Post Sources table
export const postSources = pgTable(
  'post_sources',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    title: text('title').notNull(),
    publisher: text('publisher').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('post_sources_post_id_idx').on(table.postId)]
);

// Pipeline Runs table
export interface PipelineStepRecord {
  step: string;
  status: 'pending' | 'success' | 'failed' | 'skipped';
  durationMs: number;
  details?: string;
}

export const pipelineRuns = pgTable(
  'pipeline_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    status: text('status')
      .$type<'success' | 'failed' | 'partial'>()
      .notNull(),
    steps: jsonb('steps').$type<PipelineStepRecord[]>().notNull().default([]),
    providerUsed: text('provider_used'),
    error: text('error'),
    postId: uuid('post_id').references(() => posts.id, { onDelete: 'set null' }),
  },
  (table) => [index('pipeline_runs_started_at_idx').on(table.startedAt)]
);

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
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  posts: many(posts),
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
export type PipelineRun = typeof pipelineRuns.$inferSelect;
export type NewPipelineRun = typeof pipelineRuns.$inferInsert;
