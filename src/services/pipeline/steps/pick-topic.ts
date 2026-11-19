import {
  fetchTopicCandidates,
  TopicCandidate,
} from "@/services/research/topics";
import {
  selectBestTopicCandidate,
  PastPostData,
} from "@/services/research/topic-selector";
import { getDb } from "@/db/client";
import { posts, topicQueue, categories } from "@/db/schema";
import { eq, desc, gte } from "drizzle-orm";

export interface PickTopicResult {
  topic: TopicCandidate;
  candidateCount: number;
  fromQueue?: boolean;
  queueId?: string;
  preScrapedContent?: string;
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
    "🔍 [Step 1/8: Pick Topic] Discovering topics from niche RSS feeds, ArXiv, Hugging Face & community...",
  );

  const candidates = await fetchTopicCandidates();
  if (candidates.length === 0) {
    throw new Error(
      "No candidate topics found in feeds matching the AI/tech niche.",
    );
  }

  console.log(`Found ${candidates.length} candidates matching niche keywords.`);

  // Query existing posts and source URLs to prevent duplicate coverage and enforce entity cooldown
  let pastPostData: PastPostData[] = [];

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const pastRecords = await db
      .select({
        id: posts.id,
        title: posts.title,
        topicKey: posts.topicKey,
        excerpt: posts.excerpt,
        content: posts.contentMd,
        createdAt: posts.createdAt,
      })
      .from(posts)
      .where(gte(posts.createdAt, thirtyDaysAgo))
      .orderBy(desc(posts.createdAt));

    const pastSources = await db.query.postSources.findMany({
      columns: { postId: true, url: true },
    });

    const sourceMap = new Map<string, string[]>();
    for (const s of pastSources) {
      if (s.postId) {
        const list = sourceMap.get(s.postId) || [];
        list.push(s.url);
        sourceMap.set(s.postId, list);
      }
    }

    pastPostData = pastRecords.map((p) => ({
      id: p.id,
      title: p.title,
      topicKey: p.topicKey,
      excerpt: p.excerpt,
      content: p.content,
      createdAt: p.createdAt,
      sourceUrls: p.id ? sourceMap.get(p.id) || [] : [],
    }));
  } catch (err) {
    console.warn(
      `⚠️ [Pick Topic] Could not fetch past posts for deduplication: ${(err as Error).message}`,
    );
  }

  // Select the optimal candidate using pre-scraping, entity cooldown, and multi-factor scoring
  const selectionResult = await selectBestTopicCandidate(candidates, pastPostData);

  return {
    topic: selectionResult.selectedTopic,
    candidateCount: candidates.length,
    preScrapedContent: selectionResult.preScrapedContent,
  };
}
