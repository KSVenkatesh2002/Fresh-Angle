import { and, asc, desc, eq, gte, inArray, lt, lte, ne, notInArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { categories, posts, postSlots, settings as settingsTable, xSlots } from "@/db/schema";
import { siteConfig } from "@/config/site";
import { defaultAiChain } from "@/services/ai/fallback";
import {
  computeXWeightedLength,
  formatXPostText,
  postRawTextToX,
} from "@/services/notify/buffer";

const X_SETTINGS_KEY = "x_schedule_settings";
const BLOG_COLLISION_MS = 20 * 60 * 1000;
const STALE_X_SLOT_MS = 10 * 60 * 1000;

export interface XScheduleSettings {
  extraXPostsPerDay: number;
  monthlyXCap: number;
  xWindowStart: string; // HH:mm
  xWindowEnd: string; // HH:mm
  xNoRepeatDays: number;
}

export const DEFAULT_X_SCHEDULE_SETTINGS: XScheduleSettings = {
  extraXPostsPerDay: 0,
  monthlyXCap: 300,
  xWindowStart: "08:00",
  xWindowEnd: "22:00",
  xNoRepeatDays: 14,
};

export interface XTelemetry {
  timezone: string;
  todayDate: string;
  monthKey: string;
  blogPostsPerDay: number;
  extraXPostsPerDay: number;
  totalXPostsPerDay: number;
  blogLinksDoneToday: number;
  extrasDoneToday: number;
  extrasPendingToday: number;
  monthBlogLinks: number;
  monthExtras: number;
  monthTotal: number;
  monthlyXCap: number;
}

export function getXScheduleTimezone(): string {
  return process.env.DEFAULT_TIMEZONE?.trim() || siteConfig.timezone || "Asia/Kolkata";
}

/**
 * Formats a UTC Date as YYYY-MM-DD in the given IANA timezone.
 */
export function getZonedDateString(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const map = new Map(parts.map((p) => [p.type, p.value]));
  return `${map.get("year")}-${map.get("month")}-${map.get("day")}`;
}

function getZonedOffsetMs(utcDate: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(utcDate);

  const map = new Map(parts.map((p) => [p.type, p.value]));
  const h = Number(map.get("hour")) % 24;
  const asUtc = Date.UTC(
    Number(map.get("year")),
    Number(map.get("month")) - 1,
    Number(map.get("day")),
    h,
    Number(map.get("minute")),
    Number(map.get("second")),
  );
  return asUtc - utcDate.getTime();
}

/**
 * Converts a local wall-clock date ("YYYY-MM-DD") and time ("HH:mm") in
 * `timeZone` into an exact UTC Date instance.
 */
export function zonedWallTimeToUtc(
  dateStr: string,
  hhmm: string,
  timeZone: string,
): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  const naiveUtcMs = Date.UTC(y, m - 1, d, hh || 0, mm || 0, 0, 0);
  const guess = new Date(naiveUtcMs);
  const offset1 = getZonedOffsetMs(guess, timeZone);
  const adjusted = new Date(naiveUtcMs - offset1);
  const offset2 = getZonedOffsetMs(adjusted, timeZone);
  if (offset2 !== offset1) {
    return new Date(naiveUtcMs - offset2);
  }
  return adjusted;
}

export function getZonedDayRangeUtc(
  dateStr: string,
  timeZone: string,
): { startUtc: Date; endUtc: Date } {
  const startUtc = zonedWallTimeToUtc(dateStr, "00:00", timeZone);
  const [y, m, d] = dateStr.split("-").map(Number);
  const nextDayStr = new Date(Date.UTC(y, m - 1, d + 1, 12, 0, 0))
    .toISOString()
    .slice(0, 10);
  const endUtc = zonedWallTimeToUtc(nextDayStr, "00:00", timeZone);
  return { startUtc, endUtc };
}

export function getZonedMonthRangeUtc(
  date: Date,
  timeZone: string,
): { monthKey: string; startUtc: Date; endUtc: Date } {
  const todayStr = getZonedDateString(date, timeZone);
  const [y, m] = todayStr.split("-").map(Number);
  const monthKey = `${y}-${String(m).padStart(2, "0")}`;
  const startUtc = zonedWallTimeToUtc(`${monthKey}-01`, "00:00", timeZone);
  const nextYear = m === 12 ? y + 1 : y;
  const nextMonth = m === 12 ? 1 : m + 1;
  const nextMonthStartStr = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  const endUtc = zonedWallTimeToUtc(nextMonthStartStr, "00:00", timeZone);
  return { monthKey, startUtc, endUtc };
}

export async function getXScheduleSettings(): Promise<XScheduleSettings> {
  try {
    const db = getDb();
    const row = await db.query.settings.findFirst({
      where: eq(settingsTable.key, X_SETTINGS_KEY),
    });
    if (!row?.value) {
      return DEFAULT_X_SCHEDULE_SETTINGS;
    }
    const parsed = JSON.parse(row.value) as Partial<XScheduleSettings>;
    return {
      extraXPostsPerDay: Math.max(0, Math.floor(parsed.extraXPostsPerDay ?? DEFAULT_X_SCHEDULE_SETTINGS.extraXPostsPerDay)),
      monthlyXCap: Math.max(1, Math.floor(parsed.monthlyXCap ?? DEFAULT_X_SCHEDULE_SETTINGS.monthlyXCap)),
      xWindowStart: parsed.xWindowStart || DEFAULT_X_SCHEDULE_SETTINGS.xWindowStart,
      xWindowEnd: parsed.xWindowEnd || DEFAULT_X_SCHEDULE_SETTINGS.xWindowEnd,
      xNoRepeatDays: Math.max(1, Math.floor(parsed.xNoRepeatDays ?? DEFAULT_X_SCHEDULE_SETTINGS.xNoRepeatDays)),
    };
  } catch {
    return DEFAULT_X_SCHEDULE_SETTINGS;
  }
}

export async function saveXScheduleSettings(
  next: Partial<XScheduleSettings>,
): Promise<XScheduleSettings> {
  const current = await getXScheduleSettings();
  const merged: XScheduleSettings = {
    extraXPostsPerDay: Math.max(
      0,
      Math.floor(next.extraXPostsPerDay ?? current.extraXPostsPerDay),
    ),
    monthlyXCap: Math.max(1, Math.floor(next.monthlyXCap ?? current.monthlyXCap)),
    xWindowStart: next.xWindowStart ?? current.xWindowStart,
    xWindowEnd: next.xWindowEnd ?? current.xWindowEnd,
    xNoRepeatDays: Math.max(
      1,
      Math.floor(next.xNoRepeatDays ?? current.xNoRepeatDays),
    ),
  };

  const db = getDb();
  const now = new Date();
  await db
    .insert(settingsTable)
    .values({
      key: X_SETTINGS_KEY,
      value: JSON.stringify(merged),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: settingsTable.key,
      set: { value: JSON.stringify(merged), updatedAt: now },
    });

  return merged;
}

/**
 * Pure slot generator for extra X posts inside `dateStr` using `timeZone`,
 * avoiding ±20 minutes of any scheduled blog publish time.
 */
export function calculateExtraXSlotTimes(params: {
  dateStr: string;
  count: number;
  windowStart: string;
  windowEnd: string;
  timeZone: string;
  blogPublishTimes?: Date[];
  minTimeUtc?: Date;
  jitterMinutes?: number;
}): Date[] {
  const { count } = params;
  if (count <= 0) return [];

  const windowStartUtc = zonedWallTimeToUtc(
    params.dateStr,
    params.windowStart,
    params.timeZone,
  );
  const windowEndUtc = zonedWallTimeToUtc(
    params.dateStr,
    params.windowEnd,
    params.timeZone,
  );

  const effectiveStartMs = Math.max(
    windowStartUtc.getTime(),
    params.minTimeUtc ? params.minTimeUtc.getTime() : 0,
  );
  const endMs = windowEndUtc.getTime();

  // If the remaining posting window is closed or < 2 minutes left, schedule nothing today
  if (endMs - effectiveStartMs < 2 * 60 * 1000) {
    return [];
  }

  const spanMs = endMs - effectiveStartMs;
  const maxJitterMs = (params.jitterMinutes ?? 7) * 60 * 1000;
  const avoidTimesMs = (params.blogPublishTimes ?? []).map((d) => d.getTime());

  const results: number[] = [];
  for (let i = 0; i < count; i++) {
    const fraction = count === 1 ? 0.5 : (i + 0.5) / count;
    const baseMs = Math.round(effectiveStartMs + fraction * spanMs);
    const jitterSeed = ((i * 23 + params.dateStr.charCodeAt(params.dateStr.length - 1)) % 15) - 7;
    const jitterMs = Math.min(maxJitterMs, Math.abs(jitterSeed) * 60 * 1000) * Math.sign(jitterSeed);
    let candidate = Math.max(effectiveStartMs, Math.min(endMs, baseMs + jitterMs));

    // Nudge out of ±20 min collision window of any blog publish slot
    const collides = (t: number) =>
      avoidTimesMs.some((b) => Math.abs(t - b) < BLOG_COLLISION_MS);

    if (collides(candidate)) {
      const nudgeStep = 21 * 60 * 1000;
      for (let step = 1; step <= 4; step++) {
        const plus = candidate + step * nudgeStep;
        if (plus <= endMs && !collides(plus)) {
          candidate = plus;
          break;
        }
        const minus = candidate - step * nudgeStep;
        if (minus >= effectiveStartMs && !collides(minus)) {
          candidate = minus;
          break;
        }
      }
    }

    results.push(candidate);
  }

  return results
    .sort((a, b) => a - b)
    .map((ms) => new Date(ms));
}

/**
 * Reconciles today's pending extra X slots after a settings change or tick:
 * - remaining = max(0, target - postedToday)
 * - Never alters already-posted slots.
 * - Cancels excess pending slots if remaining < pending.
 * - Adds missing slots inside the remaining window today (or applies tomorrow if closed).
 */
export async function reconcileTodayXSlots(
  settingsOverride?: XScheduleSettings,
  nowOverride?: Date,
): Promise<{ created: number; cancelled: number; windowClosed: boolean }> {
  const db = getDb();
  const settings = settingsOverride ?? (await getXScheduleSettings());
  const now = nowOverride ?? new Date();
  const tz = getXScheduleTimezone();
  const todayStr = getZonedDateString(now, tz);
  const { startUtc, endUtc } = getZonedDayRangeUtc(todayStr, tz);
  const windowEndUtc = zonedWallTimeToUtc(todayStr, settings.xWindowEnd, tz);

  const todaySlots = await db
    .select()
    .from(xSlots)
    .where(and(gte(xSlots.plannedAt, startUtc), lt(xSlots.plannedAt, endUtc)))
    .orderBy(asc(xSlots.plannedAt));

  const postedOrActive = todaySlots.filter(
    (s) => s.status === "posted" || s.status === "posting",
  ).length;
  const pendingSlots = todaySlots.filter((s) => s.status === "planned");

  const remaining = Math.max(0, settings.extraXPostsPerDay - postedOrActive);

  if (remaining < pendingSlots.length) {
    const toCancel = pendingSlots.slice(remaining);
    if (toCancel.length > 0) {
      await db
        .update(xSlots)
        .set({
          status: "cancelled",
          error: "Cancelled after Extra X posts/day target decreased",
          finishedAt: now,
        })
        .where(
          inArray(
            xSlots.id,
            toCancel.map((s) => s.id),
          ),
        );
    }
    return { created: 0, cancelled: toCancel.length, windowClosed: false };
  }

  const needed = remaining - pendingSlots.length;
  if (needed <= 0) {
    return { created: 0, cancelled: 0, windowClosed: false };
  }

  if (now.getTime() >= windowEndUtc.getTime() - 2 * 60 * 1000) {
    return { created: 0, cancelled: 0, windowClosed: true };
  }

  // Collect today's blog publish times to keep >=20m gap
  const blogSlotsToday = await db
    .select({ plannedAt: postSlots.plannedAt })
    .from(postSlots)
    .where(and(gte(postSlots.plannedAt, startUtc), lt(postSlots.plannedAt, endUtc)));

  const avoidTimes = [
    ...blogSlotsToday.map((b) => new Date(b.plannedAt)),
    ...pendingSlots.map((p) => new Date(p.plannedAt)),
  ];

  const newTimes = calculateExtraXSlotTimes({
    dateStr: todayStr,
    count: needed,
    windowStart: settings.xWindowStart,
    windowEnd: settings.xWindowEnd,
    timeZone: tz,
    blogPublishTimes: avoidTimes,
    minTimeUtc: new Date(now.getTime() + 2 * 60 * 1000),
  });

  if (newTimes.length === 0) {
    return { created: 0, cancelled: 0, windowClosed: true };
  }

  await db.insert(xSlots).values(
    newTimes.map((plannedAt) => ({
      plannedAt,
      status: "planned" as const,
    })),
  );

  return { created: newTimes.length, cancelled: 0, windowClosed: false };
}

/**
 * Picks an eligible published, non-test post not promoted or posted to X
 * within `xNoRepeatDays`.
 */
export async function pickPromoArticleForX(
  xNoRepeatDays: number,
  nowOverride?: Date,
): Promise<{
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  categoryName: string | null;
} | null> {
  const db = getDb();
  const now = nowOverride ?? new Date();
  const cutoff = new Date(now.getTime() - xNoRepeatDays * 24 * 60 * 60 * 1000);

  const recentExtraPromos = await db
    .select({ postId: xSlots.postId })
    .from(xSlots)
    .where(
      and(
        eq(xSlots.status, "posted"),
        gte(xSlots.finishedAt, cutoff),
      ),
    );

  const recentBlogXPosts = await db
    .select({ id: posts.id })
    .from(posts)
    .where(
      and(
        eq(posts.xPostStatus, "posted"),
        gte(posts.xPostedAt, cutoff),
      ),
    );

  const excludeIds = Array.from(
    new Set([
      ...recentExtraPromos.map((r) => r.postId).filter((id): id is string => Boolean(id)),
      ...recentBlogXPosts.map((r) => r.id),
    ]),
  );

  const conditions = [
    eq(posts.status, "published"),
    ne(posts.origin, "test"),
  ];
  if (excludeIds.length > 0) {
    conditions.push(notInArray(posts.id, excludeIds));
  }

  const candidateRows = await db
    .select({
      id: posts.id,
      slug: posts.slug,
      title: posts.title,
      excerpt: posts.excerpt,
      categoryId: posts.categoryId,
    })
    .from(posts)
    .where(and(...conditions))
    .orderBy(desc(posts.publishedAt))
    .limit(10);

  if (candidateRows.length === 0) {
    return null;
  }

  // Spread selections among eligible candidates using day index
  const pickIdx = Math.floor(now.getTime() / (60 * 60 * 1000)) % candidateRows.length;
  const chosen = candidateRows[pickIdx];

  let categoryName: string | null = null;
  if (chosen.categoryId) {
    const cat = await db
      .select({ name: categories.name })
      .from(categories)
      .where(eq(categories.id, chosen.categoryId))
      .limit(1);
    categoryName = cat[0]?.name ?? null;
  }

  return {
    id: chosen.id,
    slug: chosen.slug,
    title: chosen.title,
    excerpt: chosen.excerpt,
    categoryName,
  };
}

const promoHookSchema = z.object({
  hook: z.string().min(12).max(220),
  hashtag: z.string().min(2).max(40).optional(),
});

/**
 * Generates an engaging, varied promotional tweet with the canonical URL,
 * guaranteed <= 280 weighted chars (counting URL as 23).
 */
export async function generatePromoTweet(article: {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  categoryName: string | null;
}): Promise<string> {
  const url = `${siteConfig.url}/blog/${article.slug}`;

  try {
    const prompt = `Write one crisp, varied promotional social post hook for X (Twitter) highlighting a published AI/tech article.
TITLE: ${article.title}
SUMMARY: ${article.excerpt}
CATEGORY: ${article.categoryName || "AI"}

Rules:
1. Under 200 characters for the hook itself (do NOT include the URL in hook).
2. Sound analytical, human, and varied (avoid hype/emojis).
3. Include 1 short relevant hashtag if useful.
Return JSON ONLY: { "hook": "...", "hashtag": "#AI" }`;

    const { data } = await defaultAiChain.generateValidatedJson(
      {
        system: "You are a concise technical editor crafting varied X posts.",
        prompt,
        temperature: 0.7,
        maxTokens: 250,
      },
      promoHookSchema,
    );

    const tag = data.hashtag
      ? data.hashtag.startsWith("#")
        ? data.hashtag
        : `#${data.hashtag.replace(/\s+/g, "")}`
      : "";
    const tail = tag ? `\n\n${tag}\n${url}` : `\n\n${url}`;
    const combined = `${data.hook.trim()}${tail}`;
    if (computeXWeightedLength(combined) <= 280) {
      return combined;
    }
  } catch (err) {
    console.warn(
      `⚠️ [ExtraX] AI promo wording failed, using deterministic formatter: ${(err as Error).message}`,
    );
  }

  return formatXPostText({
    title: article.title,
    url,
    excerpt: article.excerpt,
    category: article.categoryName,
    variantSeed: `${article.id}:${new Date().toISOString().slice(0, 13)}`,
  });
}

export async function getXTelemetry(nowOverride?: Date): Promise<XTelemetry> {
  const db = getDb();
  const now = nowOverride ?? new Date();
  const tz = getXScheduleTimezone();
  const todayDate = getZonedDateString(now, tz);
  const { startUtc: dayStart, endUtc: dayEnd } = getZonedDayRangeUtc(todayDate, tz);
  const { monthKey, startUtc: monthStart, endUtc: monthEnd } = getZonedMonthRangeUtc(now, tz);
  const xSettings = await getXScheduleSettings();

  const [autoRow] = await db
    .select({ postsPerDay: sql<number>`posts_per_day` })
    .from(sql`automation_settings`)
    .limit(1);
  const blogPostsPerDay = Number(autoRow?.postsPerDay ?? 0);

  const [blogTodayRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(posts)
    .where(
      and(
        eq(posts.xPostStatus, "posted"),
        gte(posts.xPostedAt, dayStart),
        lt(posts.xPostedAt, dayEnd),
      ),
    );

  const todayExtraRows = await db
    .select({ status: xSlots.status })
    .from(xSlots)
    .where(and(gte(xSlots.plannedAt, dayStart), lt(xSlots.plannedAt, dayEnd)));

  const extrasDoneToday = todayExtraRows.filter((r) => r.status === "posted").length;
  const extrasPendingToday = todayExtraRows.filter((r) => r.status === "planned").length;

  const [blogMonthRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(posts)
    .where(
      and(
        eq(posts.xPostStatus, "posted"),
        gte(posts.xPostedAt, monthStart),
        lt(posts.xPostedAt, monthEnd),
      ),
    );

  const [extraMonthRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(xSlots)
    .where(
      and(
        eq(xSlots.status, "posted"),
        gte(xSlots.finishedAt, monthStart),
        lt(xSlots.finishedAt, monthEnd),
      ),
    );

  const monthBlogLinks = Number(blogMonthRow?.count ?? 0);
  const monthExtras = Number(extraMonthRow?.count ?? 0);

  return {
    timezone: tz,
    todayDate,
    monthKey,
    blogPostsPerDay,
    extraXPostsPerDay: xSettings.extraXPostsPerDay,
    totalXPostsPerDay: blogPostsPerDay + xSettings.extraXPostsPerDay,
    blogLinksDoneToday: Number(blogTodayRow?.count ?? 0),
    extrasDoneToday,
    extrasPendingToday,
    monthBlogLinks,
    monthExtras,
    monthTotal: monthBlogLinks + monthExtras,
    monthlyXCap: xSettings.monthlyXCap,
  };
}

/**
 * Executes due extra X promo slots on the scheduler tick (~15 min precision).
 * Reuses Phase 2 safeguards, enforces monthly cap, and avoids non-repeat articles.
 */
export async function runExtraXTick(
  options: { timeBudgetMs?: number; retryDelayMs?: number; nowOverride?: Date } = {},
): Promise<{ posted: number; skipped: number; failed: number }> {
  const db = getDb();
  const now = options.nowOverride ?? new Date();
  const timeBudgetMs = options.timeBudgetMs ?? 12_000;
  const tickStart = Date.now();
  const settings = await getXScheduleSettings();

  // Reclaim stale 'posting' extra X slots older than 10 minutes
  await db
    .update(xSlots)
    .set({
      status: "failed",
      error: "Reclaimed stale extra X slot lock (>10m)",
      finishedAt: now,
    })
    .where(
      and(
        eq(xSlots.status, "posting"),
        lt(xSlots.startedAt, new Date(now.getTime() - STALE_X_SLOT_MS)),
      ),
    );

  if (settings.extraXPostsPerDay > 0) {
    await reconcileTodayXSlots(settings, now);
  }

  const dueSlots = await db
    .select()
    .from(xSlots)
    .where(and(eq(xSlots.status, "planned"), lte(xSlots.plannedAt, now)))
    .orderBy(asc(xSlots.plannedAt))
    .limit(3);

  let posted = 0;
  let skipped = 0;
  let failed = 0;

  if (dueSlots.length === 0) {
    return { posted, skipped, failed };
  }

  for (const slot of dueSlots) {
    if (Date.now() - tickStart >= timeBudgetMs) {
      break;
    }

    if (process.env.ENABLE_X_POSTING !== "true") {
      await db
        .update(xSlots)
        .set({
          status: "skipped",
          error: "ENABLE_X_POSTING is disabled",
          finishedAt: new Date(),
        })
        .where(and(eq(xSlots.id, slot.id), eq(xSlots.status, "planned")));
      skipped++;
      continue;
    }

    const telemetry = await getXTelemetry(now);
    if (telemetry.monthTotal >= settings.monthlyXCap) {
      await db
        .update(xSlots)
        .set({
          status: "skipped",
          error: `Monthly X cap reached (${telemetry.monthTotal}/${settings.monthlyXCap})`,
          finishedAt: new Date(),
        })
        .where(and(eq(xSlots.id, slot.id), eq(xSlots.status, "planned")));
      skipped++;
      continue;
    }

    const claimed = await db
      .update(xSlots)
      .set({
        status: "posting",
        attempts: slot.attempts + 1,
        startedAt: new Date(),
      })
      .where(and(eq(xSlots.id, slot.id), eq(xSlots.status, "planned")))
      .returning({ id: xSlots.id });

    if (claimed.length === 0) {
      continue;
    }

    try {
      const article = await pickPromoArticleForX(settings.xNoRepeatDays, now);
      if (!article) {
        await db
          .update(xSlots)
          .set({
            status: "skipped",
            error: `No eligible published articles outside ${settings.xNoRepeatDays}-day no-repeat window`,
            finishedAt: new Date(),
          })
          .where(eq(xSlots.id, slot.id));
        skipped++;
        continue;
      }

      const tweetText = await generatePromoTweet(article);
      const result = await postRawTextToX(tweetText, {
        retryDelayMs: options.retryDelayMs,
      });

      if (result.success && result.xPostId) {
        await db
          .update(xSlots)
          .set({
            status: "posted",
            postId: article.id,
            xPostId: result.xPostId,
            error: null,
            finishedAt: new Date(),
          })
          .where(eq(xSlots.id, slot.id));
        posted++;
      } else if (result.skipped) {
        await db
          .update(xSlots)
          .set({
            status: "skipped",
            postId: article.id,
            error: result.message,
            finishedAt: new Date(),
          })
          .where(eq(xSlots.id, slot.id));
        skipped++;
      } else {
        await db
          .update(xSlots)
          .set({
            status: "failed",
            postId: article.id,
            error: result.message,
            finishedAt: new Date(),
          })
          .where(eq(xSlots.id, slot.id));
        failed++;
      }
    } catch (err: unknown) {
      const msg = (err as Error).message || "Extra X slot failure";
      await db
        .update(xSlots)
        .set({
          status: "failed",
          error: msg,
          finishedAt: new Date(),
        })
        .where(eq(xSlots.id, slot.id));
      failed++;
    }
  }

  return { posted, skipped, failed };
}

