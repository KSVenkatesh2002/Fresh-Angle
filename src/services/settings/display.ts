import { getDb } from "@/db/client";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface DisplaySettingsConfig {
  showDeveloperFooter: boolean;
  showDeveloperPostCard: boolean;
  showDeveloperAboutPage: boolean;
  showPrimarySources: boolean;
}

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettingsConfig = {
  showDeveloperFooter: false, // Default turned off as requested
  showDeveloperPostCard: false, // Default turned off as requested
  showDeveloperAboutPage: false, // Default turned off as requested
  showPrimarySources: false, // Default turned off as requested
};

const DISPLAY_SETTINGS_KEY = "site_display_preferences";

/**
 * Loads display configuration preferences from the database.
 */
export async function getDisplaySettings(): Promise<DisplaySettingsConfig> {
  try {
    const db = getDb();
    const row = await db.query.settings.findFirst({
      where: eq(settings.key, DISPLAY_SETTINGS_KEY),
    });

    if (!row || !row.value) {
      return DEFAULT_DISPLAY_SETTINGS;
    }

    const parsed = JSON.parse(row.value) as Partial<DisplaySettingsConfig>;
    return {
      ...DEFAULT_DISPLAY_SETTINGS,
      ...parsed,
    };
  } catch (err) {
    console.warn("⚠️ [DisplaySettings] Failed to load settings from DB, using defaults:", err);
    return DEFAULT_DISPLAY_SETTINGS;
  }
}

/**
 * Updates display configuration preferences in the database.
 */
export async function saveDisplaySettings(
  cfg: Partial<DisplaySettingsConfig>,
): Promise<DisplaySettingsConfig> {
  const current = await getDisplaySettings();
  const updated: DisplaySettingsConfig = {
    ...current,
    ...cfg,
  };

  const db = getDb();
  const now = new Date();
  await db
    .insert(settings)
    .values({
      key: DISPLAY_SETTINGS_KEY,
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
