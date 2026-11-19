import { TopicCandidate } from "./topics";
import {
  isDuplicateTopic,
  extractEntities,
  checkEntityCooldown,
  checkContentSimilarity,
  PastPostMeta,
} from "./dedupe";
import { extractArticleContent } from "./sources";
import { LIMITS } from "@/config/limits";

export interface PastPostData extends PastPostMeta {
  id?: string;
  topicKey: string;
  category?: string | null;
  content?: string | null;
  sourceUrls?: string[];
}

export interface CandidateEvaluation {
  candidate: TopicCandidate;
  totalScore: number;
  breakdown: {
    substanceScore: number;
    freshnessScore: number;
    authorityScore: number;
    diversityScore: number;
  };
  entities: string[];
  inCooldown: boolean;
  cooldownViolations?: string;
  isDuplicate: boolean;
  duplicateReason?: string;
  preScrapedContent?: string;
  preScrapeValid: boolean;
}

export interface SelectBestTopicResult {
  selectedTopic: TopicCandidate;
  preScrapedContent?: string;
  evaluation: CandidateEvaluation;
  totalCandidatesConsidered: number;
  validCandidatesCount: number;
}

const SUBSTANCE_POSITIVE_TERMS = [
  "benchmark",
  "benchmarks",
  "architecture",
  "open weights",
  "weights",
  "throughput",
  "latency",
  "quantization",
  "quantized",
  "fine-tuning",
  "distillation",
  "mixture of experts",
  "moe",
  "transformer",
  "inference",
  "speculative decoding",
  "synthetic data",
  "grpo",
  "rlhf",
  "reinforcement learning",
  "reasoning",
  "context window",
  "evals",
  "ablation",
  "distributed",
  "memory bandwidth",
  "hardware",
  "accelerator",
];

const SUBSTANCE_NEGATIVE_TERMS = [
  "lawsuit",
  "shares jump",
  "shares drop",
  "stock falls",
  "stock rises",
  "valuation",
  "market cap",
  "revenue",
  "earnings call",
  "billionaire",
  "allegations",
  "layoffs",
  "gossip",
  "scandal",
  "ipo",
];

/**
 * Evaluates candidate technical substance (0.0 to 1.0).
 */
export function scoreSubstance(text: string): number {
  const lower = text.toLowerCase();
  let score = 0.5; // baseline

  for (const term of SUBSTANCE_POSITIVE_TERMS) {
    if (lower.includes(term)) {
      score += 0.1;
    }
  }

  for (const term of SUBSTANCE_NEGATIVE_TERMS) {
    if (lower.includes(term)) {
      score -= 0.15;
    }
  }

  return Math.max(0.1, Math.min(1.0, score));
}

/**
 * Evaluates candidate timeliness based on publication date (0.0 to 1.0).
 */
export function scoreFreshness(pubDate?: string): number {
  if (!pubDate) return 0.5;

  const dateMs = new Date(pubDate).getTime();
  if (isNaN(dateMs)) return 0.5;

  const ageHours = (Date.now() - dateMs) / (1000 * 60 * 60);

  if (ageHours <= 12) return 1.0;
  if (ageHours <= 24) return 0.85;
  if (ageHours <= 48) return 0.7;
  if (ageHours <= 96) return 0.5;
  return 0.3;
}

/**
 * Evaluates source engineering authority (0.0 to 1.0).
 */
export function scoreAuthority(sourceFeed: string): number {
  const lower = sourceFeed.toLowerCase();
  if (
    lower.includes("arxiv") ||
    lower.includes("hugging face") ||
    lower.includes("deepmind") ||
    lower.includes("semianalysis")
  ) {
    return 1.0;
  }
  if (lower.includes("hacker news") || lower.includes("ars technica")) {
    return 0.85;
  }
  if (lower.includes("verge") || lower.includes("techcrunch") || lower.includes("venturebeat")) {
    return 0.7;
  }
  return 0.6;
}

/**
 * Evaluates topic & category diversity relative to recent posts (0.0 to 1.0).
 */
export function scoreDiversity(
  category: string,
  entities: string[],
  recentPosts: PastPostData[],
): number {
  let score = 1.0;

  // Check recent categories (last 2 posts)
  const last2Categories = recentPosts.slice(0, 2).map((p) => p.category?.toLowerCase() || "");
  if (last2Categories.length > 0 && last2Categories.every((cat) => cat === category.toLowerCase())) {
    score -= 0.4;
  }

  // Check if an entity already has 1 post in recent posts (gentle dampening before hard cooldown)
  const past7DaysPosts = recentPosts.filter((p) => {
    const postTime = typeof p.createdAt === "string" ? new Date(p.createdAt).getTime() : p.createdAt.getTime();
    return Date.now() - postTime <= 7 * 24 * 60 * 60 * 1000;
  });

  for (const entity of entities) {
    const count = past7DaysPosts.filter((p) =>
      extractEntities(p.title + " " + (p.excerpt || "")).includes(entity),
    ).length;
    if (count === 1) {
      score -= 0.25;
    }
  }

  return Math.max(0.1, score);
}

/**
 * Intelligent topic selector: pre-scrapes candidates, checks entity cooldown,
 * verifies originality, and ranks via multi-factor technical scoring.
 */
export async function selectBestTopicCandidate(
  candidates: TopicCandidate[],
  pastPosts: PastPostData[],
  maxPreScrapes: number = 5,
): Promise<SelectBestTopicResult> {
  if (candidates.length === 0) {
    throw new Error("Cannot select topic: no candidates provided.");
  }

  const existingTitles = pastPosts.map((p) => p.title);
  const existingTopicKeys = pastPosts.map((p) => p.topicKey);
  const existingUrls = pastPosts.flatMap((p) => p.sourceUrls || []);
  const pastContents = pastPosts
    .map((p) => p.content || p.excerpt || "")
    .filter((c) => c.length > 50);

  const evaluations: CandidateEvaluation[] = [];

  // Initial ranking by raw feed score + preliminary heuristics
  const sortedInitial = [...candidates].sort((a, b) => {
    const textA = a.title + " " + (a.snippet || "");
    const textB = b.title + " " + (b.snippet || "");
    const subA = scoreSubstance(textA);
    const subB = scoreSubstance(textB);
    return b.relevanceScore * 0.5 + subB * 5 - (a.relevanceScore * 0.5 + subA * 5);
  });

  let preScrapeCount = 0;

  for (const candidate of sortedInitial) {
    const combinedText = candidate.title + " " + (candidate.snippet || "");
    const entities = extractEntities(combinedText);

    // 1. Entity Cooldown Gate
    const cooldownCheck = checkEntityCooldown(entities, pastPosts);

    // 2. Title & URL Duplicate Check
    const titleDuplicateCheck = isDuplicateTopic(
      candidate.title,
      existingTitles,
      existingTopicKeys,
      candidate.url,
      existingUrls,
    );

    let isDuplicate = titleDuplicateCheck.isDuplicate;
    let duplicateReason = titleDuplicateCheck.isDuplicate
      ? `Title/URL matched "${titleDuplicateCheck.matchedWith}" (score: ${titleDuplicateCheck.score.toFixed(2)})`
      : undefined;

    // 3. Pre-scrape substantive content for top candidates
    let preScrapedContent: string | undefined;
    let preScrapeValid = true;

    if (!cooldownCheck.inCooldown && !isDuplicate && preScrapeCount < maxPreScrapes) {
      preScrapeCount++;
      try {
        console.log(`🌐 [Topic Selector] Pre-scraping source candidate: "${candidate.title}" (${candidate.url})`);
        const extracted = await extractArticleContent(candidate.url, candidate.title);
        preScrapedContent = extracted.content;

        const wordCount = extracted.content.split(/\s+/).filter(Boolean).length;
        if (wordCount < 300) {
          console.warn(`⚠️ [Topic Selector] Disqualifying thin article (${wordCount} words < 300): "${candidate.title}"`);
          preScrapeValid = false;
        } else {
          // Content-level shingle overlap check against past posts
          const contentCheck = checkContentSimilarity(extracted.content, pastContents);
          if (contentCheck.isDuplicate) {
            isDuplicate = true;
            duplicateReason = `Content shingle overlap (${(contentCheck.score * 100).toFixed(1)}% >= ${(LIMITS.sourceShingleJaccardMax * 100).toFixed(0)}%)`;
            console.warn(`⚠️ [Topic Selector] Content similarity duplicate detected: ${duplicateReason}`);
          }
        }
      } catch (err) {
        console.warn(`⚠️ [Topic Selector] Could not pre-scrape "${candidate.url}": ${(err as Error).message}`);
        // Keep valid if feed has a substantive snippet, else penalize
        if (!candidate.snippet || candidate.snippet.length < 100) {
          preScrapeValid = false;
        }
      }
    }

    // 4. Multi-Factor Scoring
    const fullText = (preScrapedContent || combinedText);
    const substanceScore = scoreSubstance(fullText);
    const freshnessScore = scoreFreshness(candidate.pubDate);
    const authorityScore = scoreAuthority(candidate.sourceFeed);
    const diversityScore = scoreDiversity(candidate.category, entities, pastPosts);

    // Weighted composite score (0.0 to 1.0)
    let totalScore =
      substanceScore * 0.35 +
      freshnessScore * 0.25 +
      authorityScore * 0.20 +
      diversityScore * 0.20;

    if (!preScrapeValid) {
      totalScore *= 0.5; // Heavy penalty for thin/failed pages
    }

    evaluations.push({
      candidate,
      totalScore,
      breakdown: {
        substanceScore,
        freshnessScore,
        authorityScore,
        diversityScore,
      },
      entities,
      inCooldown: cooldownCheck.inCooldown,
      cooldownViolations: cooldownCheck.inCooldown
        ? `Entity "${cooldownCheck.violatingEntity}" in cooldown (${cooldownCheck.postCount} posts in past ${LIMITS.entityCooldownDays} days)`
        : undefined,
      isDuplicate,
      duplicateReason,
      preScrapedContent,
      preScrapeValid,
    });
  }

  // Filter candidates that pass all gates
  const eligible = evaluations.filter(
    (e) => !e.inCooldown && !e.isDuplicate && e.preScrapeValid,
  );

  if (eligible.length > 0) {
    // Sort eligible by totalScore descending
    eligible.sort((a, b) => b.totalScore - a.totalScore);
    const best = eligible[0];
    console.log(
      `🏆 [Topic Selector] Chose optimal topic: "${best.candidate.title}" (Score: ${(best.totalScore * 100).toFixed(1)}, Feed: ${best.candidate.sourceFeed})`,
    );
    return {
      selectedTopic: best.candidate,
      preScrapedContent: best.preScrapedContent,
      evaluation: best,
      totalCandidatesConsidered: candidates.length,
      validCandidatesCount: eligible.length,
    };
  }

  // Fallback hierarchy: find candidate NOT in cooldown even if similarity/pre-scrape was borderline
  console.warn("⚠️ [Topic Selector] No candidates met all strict criteria. Finding best non-cooldown candidate...");
  const nonCooldown = evaluations.filter((e) => !e.inCooldown);
  if (nonCooldown.length > 0) {
    nonCooldown.sort((a, b) => b.totalScore - a.totalScore);
    const chosen = nonCooldown[0];
    console.warn(`🔄 [Topic Selector] Fallback selected: "${chosen.candidate.title}" (Score: ${(chosen.totalScore * 100).toFixed(1)})`);
    return {
      selectedTopic: chosen.candidate,
      preScrapedContent: chosen.preScrapedContent,
      evaluation: chosen,
      totalCandidatesConsidered: candidates.length,
      validCandidatesCount: nonCooldown.length,
    };
  }

  // Extreme fallback: take candidate with highest score overall
  evaluations.sort((a, b) => b.totalScore - a.totalScore);
  const emergencyPick = evaluations[0];
  console.warn(`🚨 [Topic Selector] Emergency fallback picked: "${emergencyPick.candidate.title}"`);
  return {
    selectedTopic: emergencyPick.candidate,
    preScrapedContent: emergencyPick.preScrapedContent,
    evaluation: emergencyPick,
    totalCandidatesConsidered: candidates.length,
    validCandidatesCount: 0,
  };
}
