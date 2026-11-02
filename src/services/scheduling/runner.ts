import { sql, eq, and, lte, asc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { automationSettings, posts, postSlots } from "@/db/schema";
import { ensurePostSlotsForDate } from "./slots";
import { runDailyPipeline } from "@/services/pipeline/run";
import { sendTelegramMessage } from "@/services/notify/telegram";
import { pingIndexNow } from "@/services/seo/indexnow";
import { siteConfig } from "@/config/site";

const ADVISORY_LOCK_ID = 827361;

export async function runSchedulerTick(): Promise<{
  executed: boolean;
  message: string;
  publishedCount?: number;
  generatedCount?: number;
}> {
  const db = getDb();

  // 1. Acquire Postgres advisory lock
  const lockRes = await db.execute<{ locked: boolean }>(
    sql`SELECT pg_try_advisory_lock(${ADVISORY_LOCK_ID}) as locked`,
  );
  const isLocked = Boolean(lockRes.rows?.[0]?.locked);

  if (!isLocked) {
    return {
      executed: false,
      message: "Another tick process is currently running",
    };
  }

  try {
    // Check automation settings
    const [settings] = await db.select().from(automationSettings).limit(1);
    if (!settings || !settings.enabled) {
      return {
        executed: false,
        message: "Automation engine is currently disabled",
      };
    }

    if (settings.pausedUntil && new Date(settings.pausedUntil) > new Date()) {
      return {
        executed: false,
        message: `Automation paused until ${new Date(settings.pausedUntil).toISOString()}`,
      };
    }

    const now = new Date();

    // 2. Publish due scheduled posts
    const dueScheduledPosts = await db.query.posts.findMany({
      where: and(eq(posts.status, "scheduled"), lte(posts.scheduledFor, now)),
      limit: 5,
    });

    let publishedCount = 0;
    for (const post of dueScheduledPosts) {
      await db
        .update(posts)
        .set({ status: "published", publishedAt: now, updatedAt: now })
        .where(eq(posts.id, post.id));

      // Trigger IndexNow ping
      await pingIndexNow([`/blog/${post.slug}`]).catch(() => {});
      publishedCount++;
    }

    // 3. Ensure today's post slots exist
    const todayStr = now.toISOString().split("T")[0];
    await ensurePostSlotsForDate(todayStr);

    // 4. Fetch due planned slots
    const graceWindowMs = settings.lateSlotGraceMinutes * 60 * 1000;
    const dueSlots = await db.query.postSlots.findMany({
      where: and(
        eq(postSlots.status, "planned"),
        lte(postSlots.plannedAt, now),
      ),
      orderBy: [asc(postSlots.plannedAt)],
      limit: 10,
    });

    if (dueSlots.length === 0) {
      return {
        executed: true,
        message: "No slots due for generation",
        publishedCount,
        generatedCount: 0,
      };
    }

    let generatedCount = 0;
    const maxPerRun = settings.maxPostsPerRun || 1;

    for (const slot of dueSlots) {
      // Check if slot has expired beyond the late grace period
      if (now.getTime() - new Date(slot.plannedAt).getTime() > graceWindowMs) {
        await db
          .update(postSlots)
          .set({
            status: "missed",
            error: "Slot exceeded late grace minutes window",
          })
          .where(eq(postSlots.id, slot.id));
        continue;
      }

      if (generatedCount >= maxPerRun) {
        break; // Respect max_posts_per_run
      }

      // Mark slot as running
      await db
        .update(postSlots)
        .set({ status: "running", startedAt: now, attempts: slot.attempts + 1 })
        .where(eq(postSlots.id, slot.id));

      try {
        // Execute pipeline
        const postId = await runDailyPipeline();

        // Mark slot as done
        await db
          .update(postSlots)
          .set({ status: "done", postId, finishedAt: new Date() })
          .where(eq(postSlots.id, slot.id));

        // Reset consecutive failures
        await db
          .update(automationSettings)
          .set({ consecutiveFailures: 0, updatedAt: new Date() });

        generatedCount++;
      } catch (err: unknown) {
        const errorMsg = (err as Error).message || "Generation failed";

        await db
          .update(postSlots)
          .set({ status: "failed", error: errorMsg, finishedAt: new Date() })
          .where(eq(postSlots.id, slot.id));

        const nextFailures = (settings.consecutiveFailures || 0) + 1;
        const shouldPause = nextFailures >= 3;

        await db.update(automationSettings).set({
          consecutiveFailures: nextFailures,
          enabled: shouldPause ? false : settings.enabled,
          pausedUntil: shouldPause
            ? new Date(Date.now() + 24 * 3600 * 1000)
            : settings.pausedUntil,
          updatedAt: new Date(),
        });

        if (shouldPause) {
          await sendTelegramMessage(
            `[${siteConfig.name}] 🚨 <b>Automation Auto-Paused!</b>\n\n` +
              `Engine paused after 3 consecutive failures.\nLast error: <code>${errorMsg.slice(0, 500)}</code>`,
          );
        }

        throw err;
      }
    }

    return {
      executed: true,
      message: `Completed tick. Published: ${publishedCount}, Generated: ${generatedCount}`,
      publishedCount,
      generatedCount,
    };
  } finally {
    // Release Postgres advisory lock
    await db.execute(sql`SELECT pg_advisory_unlock(${ADVISORY_LOCK_ID})`);
  }
}
