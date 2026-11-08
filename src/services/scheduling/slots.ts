import { eq, and, gte, lte } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  postSlots,
  automationSettings,
  dateOverrides,
  PostSlot,
} from "@/db/schema";

export interface GeneratedSlotTime {
  plannedAt: Date;
  origin: "auto" | "queue";
}

/**
 * Calculates slot times for a given day in the configured timezone.
 * Pure function suitable for unit testing.
 */
export function calculateDaySlotTimes(
  dateStr: string, // YYYY-MM-DD
  settings: {
    mode: "auto_distribute" | "fixed_times";
    postsPerDay: number;
    windowStart: string; // HH:mm
    windowEnd: string; // HH:mm
    fixedTimes: string[];
    weekdays: number[];
    weekdayOverrides: Record<string, number>;
    jitterMinutes: number;
    timezone: string;
  },
  dateOverride?: {
    enabled: boolean;
    postsCount?: number | null;
    fixedTimes?: string[] | null;
  },
): Date[] {
  // Check date overrides first
  if (dateOverride && !dateOverride.enabled) {
    return []; // Day paused or disabled by override
  }

  const [year, month, day] = dateStr.split("-").map(Number);
  // Target midnight in UTC for date calculations
  const baseDate = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = baseDate.getUTCDay();

  // If not in allowed weekdays and no date override, return empty
  if (!dateOverride && !settings.weekdays.includes(dayOfWeek)) {
    return [];
  }

  // Determine posts count
  let count = settings.postsPerDay;
  if (dateOverride?.postsCount) {
    count = dateOverride.postsCount;
  } else if (
    settings.weekdayOverrides &&
    settings.weekdayOverrides[String(dayOfWeek)] !== undefined
  ) {
    count = settings.weekdayOverrides[String(dayOfWeek)];
  }

  if (count <= 0) return [];

  const results: Date[] = [];

  if (settings.mode === "fixed_times" || dateOverride?.fixedTimes) {
    const times = dateOverride?.fixedTimes || settings.fixedTimes || [];
    for (const timeStr of times) {
      const [h, m] = timeStr.split(":").map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        const slotDate = new Date(Date.UTC(year, month - 1, day, h, m, 0));
        results.push(slotDate);
      }
    }
  } else {
    // auto_distribute mode: evenly spaced between windowStart and windowEnd
    const [startH, startM] = settings.windowStart.split(":").map(Number);
    const [endH, endM] = settings.windowEnd.split(":").map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const windowSpan = Math.max(1, endMinutes - startMinutes);

    const step = count > 1 ? windowSpan / (count - 1) : windowSpan / 2;
    const minutes: number[] = [];

    for (let i = 0; i < count; i++) {
      let targetMinute = Math.round(startMinutes + i * step);
      // Apply jitter deterministically or within range
      if (settings.jitterMinutes > 0) {
        // pseudo-random deterministic jitter based on date and slot index
        const jitterVal =
          ((i * 17 + day * 3) % (settings.jitterMinutes * 2 + 1)) -
          settings.jitterMinutes;
        targetMinute = Math.max(
          startMinutes,
          Math.min(endMinutes, targetMinute + jitterVal),
        );
      }
      minutes.push(targetMinute);
    }

    // Sort to evaluate and enforce spacing
    minutes.sort((a, b) => a - b);

    // Enforce minimum gap of ~45 minutes (when windowSpan accommodates it)
    const minDesiredGap =
      count > 1 ? Math.min(45, Math.floor((windowSpan / (count - 1)) * 0.6)) : 0;

    if (minDesiredGap > 0) {
      // Forward pass: ensure no gap smaller than minDesiredGap
      for (let i = 1; i < count; i++) {
        if (minutes[i] - minutes[i - 1] < minDesiredGap) {
          minutes[i] = minutes[i - 1] + minDesiredGap;
        }
      }
      // Backward pass: if last slot pushed past endMinutes, shift backward within bounds
      if (minutes[count - 1] > endMinutes) {
        minutes[count - 1] = endMinutes;
        for (let i = count - 2; i >= 0; i--) {
          if (minutes[i + 1] - minutes[i] < minDesiredGap) {
            minutes[i] = minutes[i + 1] - minDesiredGap;
          }
        }
      }
    }

    for (const mTotal of minutes) {
      const h = Math.floor(mTotal / 60);
      const m = mTotal % 60;
      const slotDate = new Date(Date.UTC(year, month - 1, day, h, m, 0));
      results.push(slotDate);
    }
  }

  return results.sort((a, b) => a.getTime() - b.getTime());
}

/**
 * Synchronizes post slots in the database for the given date.
 * If forceRegenerate is true, unexecuted planned slots for this date are regenerated.
 */
export async function syncPostSlotsForDate(
  dateStr: string,
  forceRegenerate: boolean = false,
): Promise<PostSlot[]> {
  const db = getDb();

  const [settings] = await db.select().from(automationSettings).limit(1);
  if (!settings || !settings.enabled) return [];

  const override = await db.query.dateOverrides.findFirst({
    where: eq(dateOverrides.date, dateStr),
  });

  const [year, month, day] = dateStr.split("-").map(Number);
  const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  const now = new Date();

  // Mark past unexecuted slots that exceeded grace period as missed
  const graceMinutes = settings.lateSlotGraceMinutes || 360;
  const graceMs = graceMinutes * 60 * 1000;
  await db
    .update(postSlots)
    .set({
      status: "missed",
      error: `Slot expired before execution (exceeded ${graceMinutes}m late grace window)`,
    })
    .where(
      and(
        eq(postSlots.status, "planned"),
        lte(postSlots.plannedAt, new Date(now.getTime() - graceMs)),
      ),
    );

  if (forceRegenerate) {
    // Delete only future unexecuted 'planned' slots for this date
    await db
      .delete(postSlots)
      .where(
        and(
          eq(postSlots.status, "planned"),
          gte(postSlots.plannedAt, startOfDay),
          lte(postSlots.plannedAt, endOfDay),
          gte(postSlots.plannedAt, now),
        ),
      );
  } else {
    // Check if valid planned slots already exist for this day
    const existing = await db.query.postSlots.findMany({
      where: and(
        gte(postSlots.plannedAt, startOfDay),
        lte(postSlots.plannedAt, endOfDay),
      ),
      orderBy: [postSlots.plannedAt],
    });

    const hasFuturePlanned = existing.some(
      (s) => s.status === "planned" && new Date(s.plannedAt) >= now,
    );
    if (hasFuturePlanned) {
      return existing;
    }

    const completedOrRunning = existing.filter(
      (s) => s.status === "done" || s.status === "running",
    );
    if (completedOrRunning.length >= settings.postsPerDay) {
      return existing;
    }
  }

  const slotTimes = calculateDaySlotTimes(
    dateStr,
    settings,
    override || undefined,
  );
  if (slotTimes.length === 0) return [];

  // If calculating for today, only schedule future slots
  const isToday = now.toISOString().split("T")[0] === dateStr;
  const targetTimes = isToday
    ? slotTimes.filter((t) => t.getTime() > now.getTime())
    : slotTimes;

  if (targetTimes.length === 0) return [];

  const inserted = await db
    .insert(postSlots)
    .values(
      targetTimes.map((plannedAt) => ({
        plannedAt,
        status: "planned" as const,
        origin: "auto" as const,
      })),
    )
    .returning();

  return inserted;
}

/**
 * Backward-compatible wrapper ensuring slots exist for date.
 */
export async function ensurePostSlotsForDate(
  dateStr: string,
): Promise<PostSlot[]> {
  return syncPostSlotsForDate(dateStr, false);
}

/**
 * Ensures upcoming slots exist for today and tomorrow.
 */
export async function ensureUpcomingSlots(): Promise<void> {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const tomorrow = new Date(now.getTime() + 86400000);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  await syncPostSlotsForDate(todayStr, false);
  await syncPostSlotsForDate(tomorrowStr, false);
}
