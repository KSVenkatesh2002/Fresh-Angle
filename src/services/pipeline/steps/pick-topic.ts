import { fetchTopicCandidates, TopicCandidate } from '@/services/research/topics';
import { isDuplicateTopic } from '@/services/research/dedupe';
import { getDb } from '@/db/client';
import { posts } from '@/db/schema';

export interface PickTopicResult {
  topic: TopicCandidate;
  candidateCount: number;
}

export async function stepPickTopic(): Promise<PickTopicResult> {
  console.log('🔍 [Step 1/8: Pick Topic] Discovering topics from niche RSS feeds and Hacker News...');

  const candidates = await fetchTopicCandidates();
  if (candidates.length === 0) {
    throw new Error('No candidate topics found in feeds matching the AI/tech niche.');
  }

  console.log(`Found ${candidates.length} candidates matching niche keywords.`);

  // Query existing posts to prevent duplicate coverage
  let existingTitles: string[] = [];
  let existingTopicKeys: string[] = [];

  try {
    const db = getDb();
    const pastPosts = await db
      .select({ title: posts.title, topicKey: posts.topicKey })
      .from(posts);

    existingTitles = pastPosts.map((p) => p.title);
    existingTopicKeys = pastPosts.map((p) => p.topicKey);
  } catch (err) {
    console.warn(`⚠️ [Pick Topic] Could not fetch past posts for deduplication: ${(err as Error).message}`);
  }

  // Find the highest-scoring non-duplicate topic
  for (const candidate of candidates) {
    const dedupeCheck = isDuplicateTopic(candidate.title, existingTitles, existingTopicKeys);
    if (!dedupeCheck.isDuplicate) {
      console.log(`✓ [Pick Topic] Selected: "${candidate.title}" (Score: ${candidate.relevanceScore})`);
      return {
        topic: candidate,
        candidateCount: candidates.length,
      };
    } else {
      console.log(`⏩ [Pick Topic] Skipping duplicate topic: "${candidate.title}" (matched: "${dedupeCheck.matchedWith}")`);
    }
  }

  // If all were deemed duplicates, pick the top candidate to maintain publishing cadence
  console.warn('⚠️ [Pick Topic] All candidate topics had similarity to past posts. Falling back to highest relevance candidate.');
  return {
    topic: candidates[0],
    candidateCount: candidates.length,
  };
}
