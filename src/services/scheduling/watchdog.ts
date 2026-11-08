import { getDb } from "@/db/client";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendTelegramMessage } from "@/services/notify/telegram";
import { siteConfig } from "@/config/site";

/**
 * Checks if a scheduler tick disruption alert should be sent to Telegram.
 * Triggered when no tick has run for 90+ minutes during the active posting window.
 * Deduplicates to prevent sending more than once every 2 hours.
 */
export async function checkTickDisruptionAlert(gapMinutes: number): Promise<boolean> {
  const db = getDb();
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 120 * 60 * 1000);

  try {
    const lastAlertRow = await db.query.settings.findFirst({
      where: eq(settings.key, "last_tick_disruption_alert_at"),
    });

    if (lastAlertRow && new Date(lastAlertRow.value) > twoHoursAgo) {
      // Alert already sent within last 2 hours; suppress duplicate
      return false;
    }

    const text =
      `[${siteConfig.name}] 🚨 <b>Scheduler Disruption Alert</b>\n\n` +
      `⚠️ No scheduler tick has executed for <b>${gapMinutes} minutes</b> during the active posting window (02:30–11:30 UTC / 08:00–17:00 IST).\n\n` +
      `🔄 Autonomous execution is resuming now.`;

    const sent = await sendTelegramMessage(text, { disableNotification: false });

    if (sent) {
      await db
        .insert(settings)
        .values({
          key: "last_tick_disruption_alert_at",
          value: now.toISOString(),
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: now.toISOString(), updatedAt: now },
        });
    }

    return sent;
  } catch (err) {
    console.warn("⚠️ [Watchdog] Failed to check/send disruption alert:", err);
    return false;
  }
}

