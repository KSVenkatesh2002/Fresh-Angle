import { getDb } from "@/db/client";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

export type NotificationChannelMode = "loud" | "silent" | "disabled";

export interface NotificationSettingsConfig {
  postPublished: NotificationChannelMode;
  postDraftTest: NotificationChannelMode;
  pipelineFailure: NotificationChannelMode;
  schedulerDisruption: NotificationChannelMode;
  quotaUsageAlerts: NotificationChannelMode;
  dbStorageAlerts: NotificationChannelMode;
  contactFormAlerts: NotificationChannelMode;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettingsConfig = {
  postPublished: "silent",
  postDraftTest: "silent",
  pipelineFailure: "loud",
  schedulerDisruption: "loud",
  quotaUsageAlerts: "loud",
  dbStorageAlerts: "loud",
  contactFormAlerts: "loud",
};

const SETTINGS_KEY = "telegram_notification_preferences";

/**
 * Loads notification settings from database, falling back to sensible defaults.
 */
export async function getNotificationSettings(): Promise<NotificationSettingsConfig> {
  try {
    const db = getDb();
    const row = await db.query.settings.findFirst({
      where: eq(settings.key, SETTINGS_KEY),
    });

    if (!row || !row.value) {
      return DEFAULT_NOTIFICATION_SETTINGS;
    }

    const parsed = JSON.parse(row.value) as Partial<NotificationSettingsConfig>;
    return {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...parsed,
    };
  } catch (err) {
    console.warn("⚠️ [NotificationSettings] Failed to fetch settings, using defaults:", err);
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
}

/**
 * Saves notification preferences to database.
 */
export async function saveNotificationSettings(
  cfg: Partial<NotificationSettingsConfig>,
): Promise<NotificationSettingsConfig> {
  const current = await getNotificationSettings();
  const updated: NotificationSettingsConfig = {
    ...current,
    ...cfg,
  };

  const db = getDb();
  const now = new Date();
  await db
    .insert(settings)
    .values({
      key: SETTINGS_KEY,
      value: JSON.stringify(updated),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: settings.key,
      set: {
        value: JSON.stringify(updated),
        updatedAt: now,
      },
    });

  return updated;
}
