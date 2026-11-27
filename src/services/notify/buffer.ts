import { and, eq, isNull, lt, ne, or } from "drizzle-orm";
import { getDb } from "@/db/client";
import { categories, posts, XPostStatus } from "@/db/schema";
import { siteConfig } from "@/config/site";
import { fetchWithTimeout, TimeoutError } from "@/lib/utils/http";

const BUFFER_GRAPHQL_ENDPOINT = "https://api.buffer.com";
const X_MAX_POST_LENGTH = 280;
const X_URL_WEIGHTED_LENGTH = 23;
const STALE_POSTING_MS = 10 * 60 * 1000;
const MAX_TRANSIENT_RETRIES = 3;

export type BufferPublishMode = "shareNow" | "addToQueue";

export interface BufferShareInput {
  title: string;
  slug: string;
  excerpt?: string | null;
  category?: string | null;
}

export interface BufferPostResult {
  success: boolean;
  skipped?: boolean;
  status: XPostStatus;
  postId?: string;
  xPostId?: string;
  channelId?: string;
  message: string;
}

interface BufferChannel {
  id: string;
  service?: string | null;
  serviceUsername?: string | null;
}

interface BufferGraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message?: string }>;
}

let cachedXChannelId: string | null = null;
let cachedForApiKey: string | null = null;

/** Reset in-memory Buffer X channel cache (used in tests). */
export function resetBufferChannelCache(): void {
  cachedXChannelId = null;
  cachedForApiKey = null;
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toHashtag(category?: string | null): string | null {
  if (!category) return null;
  const cleaned = category
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  return cleaned ? `#${cleaned}` : null;
}

/**
 * Counts X weighted character length where any http(s) URL counts as 23 chars (t.co rule).
 */
export function computeXWeightedLength(text: string): number {
  const placeholder = "x".repeat(X_URL_WEIGHTED_LENGTH);
  return text.replace(/https?:\/\/\S+/g, placeholder).length;
}

function truncateText(text: string, maxLen: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLen) return normalized;
  if (maxLen <= 1) return normalized.slice(0, Math.max(0, maxLen));
  const sliced = normalized.slice(0, maxLen - 1);
  const lastSpace = sliced.lastIndexOf(" ");
  const base = lastSpace > Math.floor(maxLen * 0.6) ? sliced.slice(0, lastSpace) : sliced;
  return `${base.trimEnd()}…`;
}

const HOOK_PREFIXES = [
  "",
  "New briefing: ",
  "Deep dive: ",
  "Fresh analysis: ",
  "Engineering breakdown: ",
];

const SECONDARY_HASHTAGS = [
  "#AI",
  "#Tech",
  "#MachineLearning",
  "#Engineering",
  "#LLMs",
];

function deterministicIndex(seed: string, mod: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % mod;
}

/**
 * Formats an article into a <= 280 weighted-char X post (counting any URL as 23 chars),
 * varying hook wording and hashtags cleanly.
 */
export function formatXPostText(input: {
  title: string;
  url: string;
  excerpt?: string | null;
  category?: string | null;
  variantSeed?: string;
}): string {
  const url = input.url.trim();
  const seed = input.variantSeed || input.title;
  const prefix = HOOK_PREFIXES[deterministicIndex(seed, HOOK_PREFIXES.length)];
  const primaryTag = toHashtag(input.category);
  const secondaryTag =
    SECONDARY_HASHTAGS[deterministicIndex(`${seed}:tag`, SECONDARY_HASHTAGS.length)];

  const tags: string[] = [];
  if (primaryTag) tags.push(primaryTag);
  if (
    secondaryTag &&
    (!primaryTag || primaryTag.toLowerCase() !== secondaryTag.toLowerCase())
  ) {
    tags.push(secondaryTag);
  }

  const buildCandidate = (bodyText: string, tagList: string[]): string => {
    const tagLine = tagList.length > 0 ? `\n\n${tagList.join(" ")}\n${url}` : `\n\n${url}`;
    return `${bodyText}${tagLine}`;
  };

  // Try hook + title + short excerpt + 2 tags
  const headline = `${prefix}${input.title.replace(/\s+/g, " ").trim()}`;
  const fullTail = tags.length > 0 ? `\n\n${tags.join(" ")}\n${url}` : `\n\n${url}`;
  const fullTailWeighted = computeXWeightedLength(fullTail);

  if (computeXWeightedLength(headline) + fullTailWeighted <= X_MAX_POST_LENGTH) {
    if (input.excerpt) {
      const remaining =
        X_MAX_POST_LENGTH - computeXWeightedLength(headline) - fullTailWeighted - 2;
      if (remaining >= 24) {
        const excerptPart = truncateText(input.excerpt, remaining);
        const withExcerpt = buildCandidate(`${headline}\n\n${excerptPart}`, tags);
        if (computeXWeightedLength(withExcerpt) <= X_MAX_POST_LENGTH) {
          return withExcerpt;
        }
      }
    }
    const withTags = buildCandidate(headline, tags);
    if (computeXWeightedLength(withTags) <= X_MAX_POST_LENGTH) {
      return withTags;
    }
  }

  // Fallback to 1 tag
  const singleTag = tags.slice(0, 1);
  const singleTail = singleTag.length > 0 ? `\n\n${singleTag[0]}\n${url}` : `\n\n${url}`;
  const singleBudget = X_MAX_POST_LENGTH - computeXWeightedLength(singleTail);
  if (singleBudget >= 24) {
    return buildCandidate(truncateText(headline, singleBudget), singleTag);
  }

  // Minimal title + URL fallback
  const minimalTail = `\n\n${url}`;
  const minimalBudget = Math.max(10, X_MAX_POST_LENGTH - computeXWeightedLength(minimalTail));
  return `${truncateText(input.title, minimalBudget)}${minimalTail}`;
}

async function queryBufferGraphQL<T>(
  apiKey: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<BufferGraphQLResponse<T>> {
  const res = await fetchWithTimeout(BUFFER_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(variables ? { query, variables } : { query }),
    timeoutMs: 10000,
  });

  const rawText = await res.text();
  let parsed: BufferGraphQLResponse<T>;
  try {
    parsed = JSON.parse(rawText) as BufferGraphQLResponse<T>;
  } catch {
    throw new Error(`HTTP ${res.status}: ${rawText.slice(0, 160)}`);
  }

  if (!res.ok) {
    const gqlErr = parsed.errors?.[0]?.message;
    throw new Error(gqlErr || `HTTP ${res.status}: ${rawText.slice(0, 160)}`);
  }

  return parsed;
}

/**
 * Resolves the Buffer X/Twitter channel ID from BUFFER_X_CHANNEL_ID or
 * auto-discovers it once via Buffer's account organizations query.
 */
export async function resolveBufferXChannelId(apiKey: string): Promise<string | null> {
  const envChannelId = process.env.BUFFER_X_CHANNEL_ID?.trim();
  if (envChannelId) {
    return envChannelId;
  }

  if (cachedXChannelId && cachedForApiKey === apiKey) {
    return cachedXChannelId;
  }

  const query = `
    query GetBufferChannels {
      account {
        organizations {
          id
          channels {
            id
            service
            serviceUsername
          }
        }
      }
    }
  `;

  const response = await queryBufferGraphQL<{
    account?: {
      organizations?: Array<{
        id: string;
        channels?: BufferChannel[];
      }>;
    };
  }>(apiKey, query);

  const orgs = response.data?.account?.organizations ?? [];
  for (const org of orgs) {
    const xChannel = (org.channels ?? []).find((ch) => {
      const svc = (ch.service ?? "").toLowerCase();
      return svc === "twitter" || svc === "x";
    });
    if (xChannel?.id) {
      cachedXChannelId = xChannel.id;
      cachedForApiKey = apiKey;
      console.log(
        `✓ [Buffer] Auto-discovered X channel "${xChannel.serviceUsername || xChannel.id}" (ID: ${xChannel.id})`,
      );
      return xChannel.id;
    }
  }

  return null;
}

interface CreatePostCallResult {
  ok: boolean;
  xPostId?: string;
  error?: string;
}

/**
 * Sends a createPost GraphQL mutation to Buffer with strict idempotency safety:
 * - Uses 10s fetchWithTimeout.
 * - Retries up to 3 times ONLY on clear pre-create failures (network errors before
 *   timeout, HTTP 5xx, HTTP 429).
 * - NEVER retries on timeout or ambiguous responses because Buffer has no
 *   idempotency key on createPost.
 */
export async function sendBufferCreatePost(params: {
  apiKey: string;
  channelId: string;
  text: string;
  mode: BufferPublishMode;
  retryDelayMs?: number;
}): Promise<CreatePostCallResult> {
  const mutation = `
    mutation CreateXPost($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess {
          post {
            id
            status
          }
        }
        ... on MutationError {
          message
        }
      }
    }
  `;

  const baseDelay = params.retryDelayMs ?? 1000;

  for (let attempt = 0; attempt <= MAX_TRANSIENT_RETRIES; attempt++) {
    let res: Response;
    try {
      res = await fetchWithTimeout(BUFFER_GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${params.apiKey}`,
        },
        body: JSON.stringify({
          query: mutation,
          variables: {
            input: {
              channelId: params.channelId,
              text: params.text,
              schedulingType: "automatic",
              mode: params.mode,
            },
          },
        }),
        timeoutMs: 10000,
      });
    } catch (err: unknown) {
      if (err instanceof TimeoutError || (err instanceof Error && err.name === "TimeoutError")) {
        // Timeout is ambiguous: Buffer may have processed createPost. Do NOT retry.
        return {
          ok: false,
          error: "unknown - check X before retrying (Buffer request timed out)",
        };
      }

      if (attempt < MAX_TRANSIENT_RETRIES) {
        await sleep(baseDelay * Math.pow(2, attempt));
        continue;
      }

      return {
        ok: false,
        error: `Network failure before send: ${(err as Error).message}`,
      };
    }

    if (res.status === 429 || res.status >= 500) {
      const errBody = await res.text().catch(() => "");
      if (attempt < MAX_TRANSIENT_RETRIES) {
        const retryAfterRaw = res.headers.get("retry-after");
        const retryAfterSec = retryAfterRaw ? parseInt(retryAfterRaw, 10) : NaN;
        const delayMs =
          !isNaN(retryAfterSec) && retryAfterSec > 0 && retryAfterSec <= 5
            ? retryAfterSec * 1000
            : baseDelay * Math.pow(2, attempt);
        await sleep(delayMs);
        continue;
      }
      return {
        ok: false,
        error: `Buffer HTTP ${res.status}: ${errBody.slice(0, 160) || res.statusText}`,
      };
    }

    const rawText = await res.text().catch(() => "");
    let parsed: BufferGraphQLResponse<{
      createPost?: {
        post?: { id?: string; status?: string };
        message?: string;
      };
    }>;

    try {
      parsed = JSON.parse(rawText);
    } catch {
      return {
        ok: false,
        error: "unknown - check X before retrying (invalid JSON response from Buffer)",
      };
    }

    if (!res.ok) {
      const gqlErr = parsed.errors?.[0]?.message;
      return {
        ok: false,
        error: gqlErr || `Buffer HTTP ${res.status}: ${rawText.slice(0, 160)}`,
      };
    }

    if (parsed.errors?.length) {
      const errMsg = parsed.errors
        .map((e) => e.message)
        .filter(Boolean)
        .join("; ");
      return { ok: false, error: errMsg || "Buffer GraphQL error" };
    }

    const payload = parsed.data?.createPost;
    if (payload?.post?.id) {
      return { ok: true, xPostId: payload.post.id };
    }

    if (payload?.message) {
      return { ok: false, error: payload.message };
    }

    return {
      ok: false,
      error: "unknown - check X before retrying (ambiguous Buffer response)",
    };
  }

  return {
    ok: false,
    error: "Exceeded maximum retry attempts",
  };
}

/**
 * Posts a published blog article to X via Buffer with atomic claim,
 * stale-lock reclaim, timeout safety, and persistent status tracking.
 * Never throws.
 */
export async function postArticleToX(
  postId: string,
  options: { force?: boolean; confirm?: boolean; retryDelayMs?: number } = {},
): Promise<BufferPostResult> {
  try {
    const db = getDb();

    const rows = await db
      .select({
        id: posts.id,
        slug: posts.slug,
        title: posts.title,
        excerpt: posts.excerpt,
        categoryId: posts.categoryId,
        status: posts.status,
        origin: posts.origin,
        xPostStatus: posts.xPostStatus,
        xPostId: posts.xPostId,
      })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);

    const post = rows[0];
    if (!post) {
      return {
        success: false,
        skipped: true,
        status: "skipped",
        postId,
        message: "Post not found",
      };
    }

    if (post.status !== "published") {
      return {
        success: false,
        skipped: true,
        status: post.xPostStatus ?? "skipped",
        postId,
        message: `Post status is "${post.status}", not published`,
      };
    }

    if (post.origin === "test") {
      await db
        .update(posts)
        .set({
          xPostStatus: "skipped",
          xPostError: "Test post excluded from X posting",
          updatedAt: new Date(),
        })
        .where(eq(posts.id, postId));
      return {
        success: false,
        skipped: true,
        status: "skipped",
        postId,
        message: "Test posts never post to X",
      };
    }

    if (post.xPostStatus === "posted" && !(options.force && options.confirm)) {
      return {
        success: false,
        skipped: true,
        status: "posted",
        postId,
        xPostId: post.xPostId ?? undefined,
        message: "Already posted to X",
      };
    }

    if (process.env.ENABLE_X_POSTING !== "true") {
      const reason = "ENABLE_X_POSTING is disabled";
      if (!post.xPostStatus || post.xPostStatus === "pending") {
        await db
          .update(posts)
          .set({
            xPostStatus: "skipped",
            xPostError: reason,
            updatedAt: new Date(),
          })
          .where(eq(posts.id, postId));
      }
      return {
        success: false,
        skipped: true,
        status: post.xPostStatus === "failed" ? "failed" : "skipped",
        postId,
        message: reason,
      };
    }

    const apiKey = process.env.BUFFER_API_KEY?.trim();
    if (!apiKey) {
      const reason = "BUFFER_API_KEY not configured";
      await db
        .update(posts)
        .set({
          xPostStatus: "skipped",
          xPostError: reason,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(posts.id, postId),
            or(isNull(posts.xPostStatus), ne(posts.xPostStatus, "posted")),
          ),
        );
      return {
        success: false,
        skipped: true,
        status: "skipped",
        postId,
        message: reason,
      };
    }

    let channelId: string | null = null;
    try {
      channelId = await resolveBufferXChannelId(apiKey);
    } catch (discoverErr) {
      const msg = `Buffer channel lookup failed: ${(discoverErr as Error).message}`;
      console.error(`❌ [Buffer] ${msg}`);
      await db
        .update(posts)
        .set({
          xPostStatus: "failed",
          xPostError: msg,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(posts.id, postId),
            or(isNull(posts.xPostStatus), ne(posts.xPostStatus, "posted")),
          ),
        );
      return { success: false, status: "failed", postId, message: msg };
    }

    if (!channelId) {
      const reason = "Missing BUFFER_X_CHANNEL_ID and no X channel found in Buffer";
      await db
        .update(posts)
        .set({
          xPostStatus: "skipped",
          xPostError: reason,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(posts.id, postId),
            or(isNull(posts.xPostStatus), ne(posts.xPostStatus, "posted")),
          ),
        );
      return {
        success: false,
        skipped: true,
        status: "skipped",
        postId,
        message: reason,
      };
    }

    // Reclaim stale 'posting' lock older than 10 minutes
    const staleThreshold = new Date(Date.now() - STALE_POSTING_MS);
    await db
      .update(posts)
      .set({
        xPostStatus: "failed",
        xPostError: "Reclaimed stale posting lock (>10 minutes)",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(posts.id, postId),
          eq(posts.xPostStatus, "posting"),
          lt(posts.updatedAt, staleThreshold),
        ),
      );

    // Atomic claim
    const allowedStates = [isNull(posts.xPostStatus), eq(posts.xPostStatus, "pending")];
    if (options.force) {
      allowedStates.push(eq(posts.xPostStatus, "failed"));
      allowedStates.push(eq(posts.xPostStatus, "skipped"));
      if (options.confirm) {
        allowedStates.push(eq(posts.xPostStatus, "posted"));
      }
    }

    const claimed = await db
      .update(posts)
      .set({
        xPostStatus: "posting",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(posts.id, postId),
          eq(posts.status, "published"),
          ne(posts.origin, "test"),
          or(...allowedStates),
        ),
      )
      .returning({ id: posts.id });

    if (claimed.length === 0) {
      return {
        success: false,
        skipped: true,
        status: post.xPostStatus ?? "skipped",
        postId,
        message: "Concurrent claim or ineligible X status; exiting cleanly",
      };
    }

    let categoryName: string | null = null;
    if (post.categoryId) {
      const catRows = await db
        .select({ name: categories.name })
        .from(categories)
        .where(eq(categories.id, post.categoryId))
        .limit(1);
      categoryName = catRows[0]?.name ?? null;
    }

    const mode: BufferPublishMode =
      process.env.BUFFER_X_MODE?.trim() === "addToQueue" ? "addToQueue" : "shareNow";

    const tweetText = formatXPostText({
      title: post.title,
      url: `${siteConfig.url}/blog/${post.slug}`,
      excerpt: post.excerpt,
      category: categoryName,
      variantSeed: post.id,
    });

    const callResult = await sendBufferCreatePost({
      apiKey,
      channelId,
      text: tweetText,
      mode,
      retryDelayMs: options.retryDelayMs,
    });

    if (callResult.ok && callResult.xPostId) {
      await db
        .update(posts)
        .set({
          xPostStatus: "posted",
          xPostId: callResult.xPostId,
          xPostedAt: new Date(),
          xPostError: null,
          updatedAt: new Date(),
        })
        .where(eq(posts.id, postId));

      console.log(
        `✓ [Buffer] Posted "${post.slug}" to X (${mode}, Buffer post ID: ${callResult.xPostId})`,
      );
      return {
        success: true,
        status: "posted",
        postId,
        xPostId: callResult.xPostId,
        channelId,
        message: `Posted to X via Buffer (${mode})`,
      };
    }

    const errMsg = callResult.error || "Unknown Buffer error";
    await db
      .update(posts)
      .set({
        xPostStatus: "failed",
        xPostError: errMsg,
        updatedAt: new Date(),
      })
      .where(eq(posts.id, postId));

    console.error(`❌ [Buffer] Failed to post "${post.slug}" to X: ${errMsg}`);
    return {
      success: false,
      status: "failed",
      postId,
      channelId,
      message: errMsg,
    };
  } catch (err: unknown) {
    const errMsg = (err as Error).message || "Unexpected Buffer exception";
    console.error(`❌ [Buffer] Exception in postArticleToX(${postId}): ${errMsg}`);
    return {
      success: false,
      status: "failed",
      postId,
      message: errMsg,
    };
  }
}

/**
 * Posts arbitrary pre-formatted text to X via Buffer (used for admin test posts
 * and Phase 3 scheduled promotional X posts). Never throws.
 */
export async function postRawTextToX(
  text: string,
  options: { retryDelayMs?: number } = {},
): Promise<BufferPostResult> {
  if (process.env.ENABLE_X_POSTING !== "true") {
    return {
      success: false,
      skipped: true,
      status: "skipped",
      message: "ENABLE_X_POSTING is disabled",
    };
  }

  const apiKey = process.env.BUFFER_API_KEY?.trim();
  if (!apiKey) {
    return {
      success: false,
      skipped: true,
      status: "skipped",
      message: "BUFFER_API_KEY not configured",
    };
  }

  try {
    const channelId = await resolveBufferXChannelId(apiKey);
    if (!channelId) {
      return {
        success: false,
        skipped: true,
        status: "skipped",
        message: "Missing BUFFER_X_CHANNEL_ID and no X channel found in Buffer",
      };
    }

    const mode: BufferPublishMode =
      process.env.BUFFER_X_MODE?.trim() === "addToQueue" ? "addToQueue" : "shareNow";

    const res = await sendBufferCreatePost({
      apiKey,
      channelId,
      text,
      mode,
      retryDelayMs: options.retryDelayMs,
    });

    if (res.ok && res.xPostId) {
      return {
        success: true,
        status: "posted",
        xPostId: res.xPostId,
        channelId,
        message: `Posted to X via Buffer (${mode})`,
      };
    }

    const errMsg = res.error || "Unknown Buffer error";
    console.error(`❌ [Buffer] Failed raw X post: ${errMsg}`);
    return {
      success: false,
      status: "failed",
      channelId,
      message: errMsg,
    };
  } catch (err: unknown) {
    const errMsg = (err as Error).message;
    console.error(`❌ [Buffer] Exception in postRawTextToX: ${errMsg}`);
    return {
      success: false,
      status: "failed",
      message: errMsg,
    };
  }
}

/**
 * Admin-only helper to send a harmless verification test post to X via Buffer.
 */
export async function sendTestPostToX(): Promise<BufferPostResult> {
  const apiKey = process.env.BUFFER_API_KEY?.trim();
  if (!apiKey) {
    return {
      success: false,
      skipped: true,
      status: "skipped",
      message: "BUFFER_API_KEY not configured",
    };
  }

  try {
    const channelId = await resolveBufferXChannelId(apiKey);
    if (!channelId) {
      return {
        success: false,
        skipped: true,
        status: "skipped",
        message: "Missing BUFFER_X_CHANNEL_ID and no X channel found in Buffer",
      };
    }

    const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    const text = `Connection test from ${siteConfig.name} editorial automation (${stamp} UTC).`;
    const mode: BufferPublishMode =
      process.env.BUFFER_X_MODE?.trim() === "addToQueue" ? "addToQueue" : "shareNow";

    const res = await sendBufferCreatePost({ apiKey, channelId, text, mode });
    if (res.ok && res.xPostId) {
      return {
        success: true,
        status: "posted",
        xPostId: res.xPostId,
        channelId,
        message: `Test post sent to X via Buffer (${mode}, ID: ${res.xPostId})`,
      };
    }

    return {
      success: false,
      status: "failed",
      channelId,
      message: res.error || "Buffer test post failed",
    };
  } catch (err: unknown) {
    const errMsg = (err as Error).message;
    console.error(`❌ [Buffer] Test post exception: ${errMsg}`);
    return {
      success: false,
      status: "failed",
      message: errMsg,
    };
  }
}
