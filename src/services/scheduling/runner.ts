import { sql, eq, and, lte, asc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { automationSettings, posts, postSlots, settings as settingsTable } from "@/db/schema";
import { ensurePostSlotsForDate } from "./slots";
import { runDailyPipeline } from "@/services/pipeline/run";
import { sendTelegramMessage } from "@/services/notify/telegram";
import { pingIndexNow } from "@/services/seo/indexnow";
import { siteConfig } from "@/config/site";
import { runDailyDatabaseMaintenance } from "@/services/maintenance/database";
import { checkTickDisruptionAlert } from "./watchdog";
import { formatDualTime } from "@/lib/utils/time";
import { recordSlotEvent } from "./events";

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
    const now = new Date();

    // 0. Daily database retention & health monitoring (runs once per 24 hours)
    try {
      await runDailyDatabaseMaintenance();
    } catch (maintErr) {
      console.warn("⚠️ [Tick] Daily database maintenance error:", maintErr);
    }

    // 0.1 Check tick gap during active posting window (02:30–11:30 UTC / 08:00–17:00 IST)
    try {
      const lastTickRow = await db.query.settings.findFirst({
        where: eq(settingsTable.key, "last_tick_at"),
      });

      if (lastTickRow && lastTickRow.value) {
        const lastTickTime = new Date(lastTickRow.value).getTime();
        const gapMinutes = Math.floor((now.getTime() - lastTickTime) / (60 * 1000));

        const utcMinuteOfDay = now.getUTCHours() * 60 + now.getUTCMinutes();
        const isPostingWindow = utcMinuteOfDay >= 150 && utcMinuteOfDay <= 690; // 02:30 to 11:30 UTC

        if (gapMinutes >= 90 && isPostingWindow) {
          await checkTickDisruptionAlert(gapMinutes);
        }
      }

      await db
        .insert(settingsTable)
        .values({
          key: "last_tick_at",
          value: now.toISOString(),
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: settingsTable.key,
          set: { value: now.toISOString(), updatedAt: now },
        });
    } catch (watchdogErr) {
      console.warn("⚠️ [Tick] Watchdog check error:", watchdogErr);
    }

    // Check automation settings
    const [settings] = await db.select().from(automationSettings).limit(1);
    if (!settings || !settings.enabled) {
      return {
        executed: false,
        message: "Automation engine is currently disabled",
      };
    }

    if (settings.pausedUntil && new Date(settings.pausedUntil) > now) {
      return {
        executed: false,
        message: `Automation paused until ${new Date(settings.pausedUntil).toISOString()}`,
      };
    }

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

    // 4. Fetch due planned slots ordered oldest first
    const graceMinutes = settings.lateSlotGraceMinutes || 360;
    const graceWindowMs = graceMinutes * 60 * 1000;
    const maxPerRun = settings.maxPostsPerRun || 2;

    const dueSlots = await db.query.postSlots.findMany({
      where: and(
        eq(postSlots.status, "planned"),
        lte(postSlots.plannedAt, now),
      ),
      orderBy: [asc(postSlots.plannedAt)], // Oldest due slot first
      limit: 20,
    });

    if (dueSlots.length === 0) {
      return {
        executed: true,
        message: "No slots due for generation",
        publishedCount,
        generatedCount: 0,
      };
    }

    // Separate slots into valid (within grace window) and expired (exceeded grace window)
    const validDueSlots: typeof dueSlots = [];
    const expiredSlots: typeof dueSlots = [];

    for (const slot of dueSlots) {
      const slotAgeMs = now.getTime() - new Date(slot.plannedAt).getTime();
      if (slotAgeMs > graceWindowMs) {
        expiredSlots.push(slot);
      } else {
        validDueSlots.push(slot);
      }
    }

    // Mark all expired slots as missed with explicit, descriptive reason
    for (const slot of expiredSlots) {
      const plannedTimeIso = new Date(slot.plannedAt).toISOString();
      const ageMinutes = Math.round((now.getTime() - new Date(slot.plannedAt).getTime()) / (60 * 1000));
      await db
        .update(postSlots)
        .set({
          status: "missed",
          error: `Slot expired: exceeded ${graceMinutes}m late grace window (${ageMinutes}m elapsed, planned: ${plannedTimeIso})`,
        })
        .where(eq(postSlots.id, slot.id));

      await recordSlotEvent({
        slotId: slot.id,
        eventType: "missed",
        details: { ageMinutes, graceMinutes, plannedTimeIso },
      });
    }

    if (validDueSlots.length === 0) {
      return {
        executed: true,
        message: expiredSlots.length > 0
          ? `Marked ${expiredSlots.length} expired slots as missed (exceeded ${graceMinutes}m grace window)`
          : "No slots due for generation",
        publishedCount,
        generatedCount: 0,
      };
    }

    // Take oldest due valid slots up to max_posts_per_run
    const slotsToProcess = validDueSlots.slice(0, maxPerRun);
    let generatedCount = 0;

    for (const slot of slotsToProcess) {
      if (generatedCount >= maxPerRun) {
        break; // Strictly respect max_posts_per_run
      }

      // Mark slot as running
      await db
        .update(postSlots)
        .set({ status: "running", startedAt: now, attempts: slot.attempts + 1 })
        .where(eq(postSlots.id, slot.id));

      await recordSlotEvent({
        slotId: slot.id,
        eventType: "claimed",
        details: { plannedAt: slot.plannedAt, attempt: slot.attempts + 1 },
      });

      try {
        const slotDate = new Date(slot.plannedAt);
        const slotTimeDisplay = formatDualTime(slotDate);

        const isTestSlot = slot.origin === "test";

        // Execute pipeline with explicit slot attribution
        const postId = await runDailyPipeline({
          triggerSource: isTestSlot ? "test" : "scheduled",
          slotTime: slotTimeDisplay,
          slotId: slot.id,
          isTest: isTestSlot,
        });

        // Mark slot as done
        await db
          .update(postSlots)
          .set({ status: "done", postId, finishedAt: new Date() })
          .where(eq(postSlots.id, slot.id));

        await recordSlotEvent({
          slotId: slot.id,
          eventType: "published",
          details: { postId },
        });

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

        await recordSlotEvent({
          slotId: slot.id,
          eventType: "failed",
          details: { error: errorMsg },
        });

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
