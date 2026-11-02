import { XMLParser } from 'fast-xml-parser';
import { fetchWithRetry } from '@/lib/utils/http';
import { TOPIC_FEEDS, NICHE_KEYWORDS } from '@/config/feeds';
import { PIPELINE_CONFIG } from '@/config/pipeline';

export interface TopicCandidate {
  title: string;
  url: string;
  sourceFeed: string;
  category: string;
  pubDate?: string;
  relevanceScore: number;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

/**
 * Checks if a title or description contains keywords relevant to the AI & tech niche.
 */
export function scoreTopicRelevance(text: string): number {
  const lower = text.toLowerCase();
  let score = 0;

  for (const kw of NICHE_KEYWORDS) {
    if (lower.includes(kw)) {
      score += kw.length > 5 ? 2 : 1;
    }
  }

  return score;
}

/**
 * Parses RSS / Atom XML feeds and extracts candidate items.
 */
export function parseRssFeedItems(
  xmlData: string,
  feedName: string,
  category: string
): TopicCandidate[] {
  try {
    const parsed = xmlParser.parse(xmlData);
    const candidates: TopicCandidate[] = [];

    // RSS 2.0 structure
    const items =
      parsed?.rss?.channel?.item ||
      parsed?.feed?.entry ||
      [];

    const list = Array.isArray(items) ? items : [items];

    for (const item of list) {
      if (!item) continue;

      const title = typeof item.title === 'string' ? item.title : item.title?.['#text'] || '';
      let url = '';

      if (typeof item.link === 'string') {
        url = item.link;
      } else if (item.link?.['@_href']) {
        url = item.link['@_href'];
      } else if (item.guid?.['#text']) {
        url = item.guid['#text'];
      }

      if (!title || !url || !url.startsWith('http')) continue;

      const relevanceScore = scoreTopicRelevance(title);

      // Only include topics that match niche keywords
      if (relevanceScore > 0) {
        candidates.push({
          title: title.trim(),
          url: url.trim(),
          sourceFeed: feedName,
          category,
          pubDate: item.pubDate || item.published || item.updated,
          relevanceScore,
        });
      }
    }

    return candidates;
  } catch (err: unknown) {
    console.warn(`⚠️ [Research] Failed to parse XML for feed "${feedName}": ${(err as Error).message}`);
    return [];
  }
}

/**
 * Fetches top candidates across all configured RSS feeds.
 */
export async function fetchTopicCandidates(): Promise<TopicCandidate[]> {
  const allCandidates: TopicCandidate[] = [];

  for (const feed of TOPIC_FEEDS) {
    try {
      console.log(`📡 [Research] Fetching feed: ${feed.name}...`);
      const response = await fetchWithRetry(
        feed.url,
        {
          headers: {
            'User-Agent': 'FreshAngleBot/1.0 (+https://freshangle.vercel.app)',
            Accept: 'application/rss+xml, application/xml, text/xml',
          },
          timeoutMs: PIPELINE_CONFIG.limits.httpTimeoutMs,
        },
        { retries: 2, backoffMs: 1000 }
      );

      if (!response.ok) {
        console.warn(`⚠️ [Research] Feed ${feed.name} returned status ${response.status}`);
        continue;
      }

      const xmlText = await response.text();
      const items = parseRssFeedItems(xmlText, feed.name, feed.category);

      // Apply feed weight
      items.forEach((item) => {
        item.relevanceScore = Math.round(item.relevanceScore * feed.weight * 10) / 10;
      });

      allCandidates.push(...items);
    } catch (err: unknown) {
      console.warn(`⚠️ [Research] Could not fetch feed ${feed.name}: ${(err as Error).message}`);
    }
  }

  // Sort by highest relevance score
  return allCandidates.sort((a, b) => b.relevanceScore - a.relevanceScore);
}
