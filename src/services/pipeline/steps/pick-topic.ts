import {
  fetchTopicCandidates,
  TopicCandidate,
} from "@/services/research/topics";
import { isDuplicateTopic } from "@/services/research/dedupe";
import { getDb } from "@/db/client";
import { posts, topicQueue, categories } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export interface PickTopicResult {
  topic: TopicCandidate;
  candidateCount: number;
  fromQueue?: boolean;
  queueId?: string;
}

export interface PickTopicOptions {
  queueId?: string;
  categoryId?: string;
  slotId?: string;
}

export async function stepPickTopic(options: PickTopicOptions = {}): Promise<PickTopicResult> {
  const db = getDb();

  // 1. TOPIC QUEUE FIRST: Check if an item in topic_queue is queued
  try {
    const queueQuery = db
      .select({
        id: topicQueue.id,
        title: topicQueue.title,
        prompt: topicQueue.prompt,
        categoryId: topicQueue.categoryId,
        tags: topicQueue.tags,
        sourceUrls: topicQueue.sourceUrls,
      })
      .from(topicQueue)
      .where(
        options.queueId
          ? eq(topicQueue.id, options.queueId)
          : eq(topicQueue.status, "queued")
      )
      .orderBy(desc(topicQueue.priority), desc(topicQueue.createdAt));

    const queuedItems = await queueQuery.limit(1);

    if (queuedItems.length > 0) {
      const qItem = queuedItems[0];
      console.log(`🎯 [Topic Queue Priority] Picked manual queued topic: "${qItem.title}" (ID: ${qItem.id})`);

      // Mark topicQueue item as generating
      await db
        .update(topicQueue)
        .set({ status: "generating" })
        .where(eq(topicQueue.id, qItem.id));

      // Resolve category name if linked
      let categoryName = "Artificial Intelligence";
      if (qItem.categoryId) {
        const cat = await db.query.categories.findFirst({
          where: eq(categories.id, qItem.categoryId),
        });
        if (cat) categoryName = cat.name;
      }

      return {
        topic: {
          title: qItem.title,
          url: qItem.sourceUrls?.[0] || "https://news.ycombinator.com",
          sourceFeed: "Topic Queue (Manual Priority)",
          category: categoryName,
          pubDate: new Date().toISOString(),
          relevanceScore: 100,
        },
        candidateCount: 1,
        fromQueue: true,
        queueId: qItem.id,
      };
    }
  } catch (queueErr) {
    console.warn("⚠️ [Pick Topic] Failed to check topic queue:", queueErr);
  }

  // 2. Fall back to niche RSS feeds and trending sources
  console.log(
    "🔍 [Step 1/8: Pick Topic] Discovering topics from niche RSS feeds and Hacker News...",
  );

  const candidates = await fetchTopicCandidates();
  if (candidates.length === 0) {
    throw new Error(
      "No candidate topics found in feeds matching the AI/tech niche.",
    );
  }

  console.log(`Found ${candidates.length} candidates matching niche keywords.`);

  // Query existing posts and source URLs to prevent duplicate coverage
  let existingTitles: string[] = [];
  let existingTopicKeys: string[] = [];
  let existingSourceUrls: string[] = [];

  try {
    const db = getDb();
    const pastPosts = await db
      .select({ title: posts.title, topicKey: posts.topicKey })
      .from(posts);

    existingTitles = pastPosts.map((p) => p.title);
    existingTopicKeys = pastPosts.map((p) => p.topicKey);

    const pastSources = await db.query.postSources.findMany({
      columns: { url: true },
    });
    existingSourceUrls = pastSources.map((s) => s.url);
  } catch (err) {
    console.warn(
      `⚠️ [Pick Topic] Could not fetch past posts for deduplication: ${(err as Error).message}`,
    );
  }

  // Find the highest-scoring non-duplicate topic
  for (const candidate of candidates) {
    const dedupeCheck = isDuplicateTopic(
      candidate.title,
      existingTitles,
      existingTopicKeys,
      candidate.url,
      existingSourceUrls,
    );
    if (!dedupeCheck.isDuplicate) {
      console.log(
        `✓ [Pick Topic] Selected: "${candidate.title}" (Score: ${candidate.relevanceScore})`,
      );
      return {
        topic: candidate,
        candidateCount: candidates.length,
      };
    } else {
      console.log(
        `⏩ [Pick Topic] Skipping duplicate topic: "${candidate.title}" (matched: "${dedupeCheck.matchedWith}", score: ${dedupeCheck.score.toFixed(2)})`,
      );
    }
  }

  // If all were deemed duplicates, pick the top candidate to maintain publishing cadence
  console.warn(
    "⚠️ [Pick Topic] All candidate topics had similarity to past posts. Falling back to highest relevance candidate.",
  );
  return {
    topic: candidates[0],
    candidateCount: candidates.length,
  };
}
