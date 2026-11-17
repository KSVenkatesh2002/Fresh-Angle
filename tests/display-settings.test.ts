import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DEFAULT_DISPLAY_SETTINGS,
  getDisplaySettings,
  saveDisplaySettings,
  DisplaySettingsConfig,
} from "@/services/settings/display";

vi.mock("@/db/client", () => ({
  getDb: vi.fn(),
}));

import { getDb } from "@/db/client";

describe("DisplaySettings & Telegram Join Toggle", () => {
  let mockStorage: Record<string, string>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage = {};

    const mockDb = {
      query: {
        settings: {
          findFirst: vi.fn().mockImplementation(async ({ where }) => {
            const val = mockStorage["site_display_preferences"];
            if (!val) return null;
            return { key: "site_display_preferences", value: val };
          }),
        },
      },
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation((val) => ({
          onConflictDoUpdate: vi.fn().mockImplementation(async () => {
            mockStorage[val.key] = val.value;
            return [{ key: val.key, value: val.value }];
          }),
        })),
      }),
    };

    (getDb as any).mockReturnValue(mockDb);
  });

  it("returns default display settings including showTelegramJoin: true when no DB record exists", async () => {
    const settings = await getDisplaySettings();
    expect(settings.showTelegramJoin).toBe(true);
    expect(settings.telegramChannelUrl).toBe("https://t.me/freshangle_blog");
    expect(settings.showDeveloperFooter).toBe(false);
    expect(settings.showDeveloperPostCard).toBe(false);
    expect(settings.showDeveloperAboutPage).toBe(false);
    expect(settings.showPrimarySources).toBe(false);
    expect(settings.showEditorialAuthor).toBe(false);
  });

  it("defaults showTelegramJoin to true if older DB record does not include showTelegramJoin field", async () => {
    mockStorage["site_display_preferences"] = JSON.stringify({
      showDeveloperFooter: false,
      showDeveloperPostCard: false,
      showDeveloperAboutPage: true,
      showPrimarySources: false,
      showEditorialAuthor: false,
    });

    const settings = await getDisplaySettings();
    expect(settings.showTelegramJoin).toBe(true);
    expect(settings.showDeveloperAboutPage).toBe(true);
    expect(settings.telegramChannelUrl).toBe("https://t.me/freshangle_blog");
  });

  it("allows turning off showTelegramJoin and saving custom channel URL", async () => {
    const updated = await saveDisplaySettings({
      showTelegramJoin: false,
      telegramChannelUrl: "https://t.me/custom_channel",
    });

    expect(updated.showTelegramJoin).toBe(false);
    expect(updated.telegramChannelUrl).toBe("https://t.me/custom_channel");

    const reloaded = await getDisplaySettings();
    expect(reloaded.showTelegramJoin).toBe(false);
    expect(reloaded.telegramChannelUrl).toBe("https://t.me/custom_channel");
  });

  it("allows re-enabling showTelegramJoin after being turned off", async () => {
    await saveDisplaySettings({ showTelegramJoin: false });
    expect((await getDisplaySettings()).showTelegramJoin).toBe(false);

    await saveDisplaySettings({ showTelegramJoin: true });
    expect((await getDisplaySettings()).showTelegramJoin).toBe(true);
  });
});
