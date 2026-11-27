import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  calculateExtraXSlotTimes,
  getZonedDateString,
  reconcileTodayXSlots,
  runExtraXTick,
  pickPromoArticleForX,
  DEFAULT_X_SCHEDULE_SETTINGS,
} from "../src/services/scheduling/x-slots";

const mockGetDb = vi.fn();
const mockPostRawTextToX = vi.fn();

vi.mock("@/db/client", () => ({
  getDb: () => mockGetDb(),
}));

vi.mock("@/services/ai/fallback", () => ({
  defaultAiChain: {
    generateValidatedJson: vi.fn().mockRejectedValue(new Error("Offline test mode")),
  },
}));

vi.mock("@/services/notify/buffer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/services/notify/buffer")>();
  return {
    ...actual,
    postRawTextToX: (...args: unknown[]) => mockPostRawTextToX(...args),
  };
});

describe("Phase 3: Extra X Promotional Schedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DEFAULT_TIMEZONE = "Asia/Kolkata";
    process.env.ENABLE_X_POSTING = "true";
  });

  it("uses DEFAULT_TIMEZONE (Asia/Kolkata) for date boundaries rather than UTC", () => {
    // 2026-11-27T19:00:00Z is 2026-11-28 00:30 IST (+05:30)
    const utcMoment = new Date("2026-11-27T19:00:00Z");
    expect(getZonedDateString(utcMoment, "UTC")).toBe("2026-11-27");
    expect(getZonedDateString(utcMoment, "Asia/Kolkata")).toBe("2026-11-28");
  });

  it("avoids scheduling extra X slots within 20 minutes of blog publish slots", () => {
    // Window 08:00-22:00 IST on 2026-11-28
    const blogPublish = new Date("2026-11-28T09:30:00Z"); // 15:00 IST (exact middle)
    const slots = calculateExtraXSlotTimes({
      dateStr: "2026-11-28",
      count: 1,
      windowStart: "08:00",
      windowEnd: "22:00",
      timeZone: "Asia/Kolkata",
      blogPublishTimes: [blogPublish],
    });

    expect(slots).toHaveLength(1);
    const diffMinutes = Math.abs(slots[0].getTime() - blogPublish.getTime()) / 60_000;
    expect(diffMinutes).toBeGreaterThanOrEqual(20);
  });

  it("reconciles mid-day increase by adding only needed slots inside remaining window", async () => {
    // 10:00 IST (04:30Z) — 12 hours left until 22:00 IST
    const now = new Date("2026-11-28T04:30:00Z");
    const insertedValues: Array<Record<string, unknown>> = [];

    mockGetDb.mockReturnValue({
      select: vi.fn(() => ({
        from: vi.fn((table) => {
          const isXSlots = String(table) !== String("postSlots");
          return {
            where: vi.fn(() => {
              if (isXSlots) {
                return {
                  orderBy: vi.fn().mockResolvedValue([
                    { id: "xs-1", status: "posted", plannedAt: new Date("2026-11-28T03:00:00Z") },
                  ]),
                };
              }
              return Promise.resolve([]);
            }),
          };
        }),
      })),
      insert: vi.fn(() => ({
        values: vi.fn((rows: Array<Record<string, unknown>>) => {
          insertedValues.push(...rows);
          return Promise.resolve(rows);
        }),
      })),
    });

    // Fix select mock cleanly based on query call order:
    let selectStep = 0;
    mockGetDb.mockReturnValue({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => {
            selectStep++;
            if (selectStep === 1) {
              return {
                orderBy: vi.fn().mockResolvedValue([
                  { id: "xs-1", status: "posted", plannedAt: new Date("2026-11-28T03:00:00Z") },
                ]),
              };
            }
            return Promise.resolve([]);
          }),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn((rows: Array<Record<string, unknown>>) => {
          insertedValues.push(...rows);
          return Promise.resolve(rows);
        }),
      })),
    });

    const result = await reconcileTodayXSlots(
      { ...DEFAULT_X_SCHEDULE_SETTINGS, extraXPostsPerDay: 3 },
      now,
    );

    expect(result.created).toBe(2);
    expect(result.cancelled).toBe(0);
    expect(result.windowClosed).toBe(false);
    expect(insertedValues).toHaveLength(2);
  });

  it("reconciles mid-day decrease below already-posted by keeping posted slots untouched and cancelling pending", async () => {
    const now = new Date("2026-11-28T06:00:00Z"); // 11:30 IST
    const cancelledUpdates: Array<Record<string, unknown>> = [];

    mockGetDb.mockReturnValue({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn().mockResolvedValue([
              { id: "xs-1", status: "posted", plannedAt: new Date("2026-11-28T03:00:00Z") },
              { id: "xs-2", status: "posted", plannedAt: new Date("2026-11-28T04:30:00Z") },
              { id: "xs-3", status: "planned", plannedAt: new Date("2026-11-28T08:00:00Z") },
              { id: "xs-4", status: "planned", plannedAt: new Date("2026-11-28T11:00:00Z") },
            ]),
          })),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn((vals: Record<string, unknown>) => {
          cancelledUpdates.push(vals);
          return { where: vi.fn().mockResolvedValue([]) };
        }),
      })),
    });

    // Lower target to 1 (already 2 posted today -> remaining = 0 -> cancel both pending slots)
    const result = await reconcileTodayXSlots(
      { ...DEFAULT_X_SCHEDULE_SETTINGS, extraXPostsPerDay: 1 },
      now,
    );

    expect(result.created).toBe(0);
    expect(result.cancelled).toBe(2);
    expect(cancelledUpdates[0]).toMatchObject({ status: "cancelled" });
  });

  it("adds 0 slots today and defers to tomorrow when increase happens after window closed", async () => {
    // 23:00 IST (17:30Z), window ended at 22:00 IST
    const now = new Date("2026-11-28T17:30:00Z");

    mockGetDb.mockReturnValue({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn().mockResolvedValue([]),
          })),
        })),
      })),
    });

    const result = await reconcileTodayXSlots(
      { ...DEFAULT_X_SCHEDULE_SETTINGS, extraXPostsPerDay: 2 },
      now,
    );

    expect(result.created).toBe(0);
    expect(result.windowClosed).toBe(true);
  });

  it("stops extra X posts when monthly cap is reached (including blog-link posts)", async () => {
    const now = new Date("2026-11-28T09:00:00Z");
    const updatedStatuses: Array<Record<string, unknown>> = [];
    let selectIndex = 0;

    mockGetDb.mockReturnValue({
      query: {
        settings: {
          findFirst: vi.fn().mockResolvedValue({
            value: JSON.stringify({
              ...DEFAULT_X_SCHEDULE_SETTINGS,
              extraXPostsPerDay: 0,
              monthlyXCap: 300,
            }),
          }),
        },
      },
      update: vi.fn(() => ({
        set: vi.fn((vals: Record<string, unknown>) => {
          updatedStatuses.push(vals);
          return { where: vi.fn().mockResolvedValue([]) };
        }),
      })),
      select: vi.fn(() => {
        selectIndex++;
        if (selectIndex === 1) {
          // dueSlots
          return {
            from: () => ({
              where: () => ({
                orderBy: () => ({
                  limit: vi.fn().mockResolvedValue([
                    {
                      id: "due-slot-1",
                      plannedAt: new Date(now.getTime() - 60_000),
                      status: "planned",
                      attempts: 0,
                    },
                  ]),
                }),
              }),
            }),
          };
        }
        if (selectIndex === 2) {
          // automation_settings postsPerDay
          return {
            from: () => ({ limit: vi.fn().mockResolvedValue([{ postsPerDay: 3 }]) }),
          };
        }
        if (selectIndex === 3) {
          // blogLinksDoneToday
          return { from: () => ({ where: vi.fn().mockResolvedValue([{ count: 2 }]) }) };
        }
        if (selectIndex === 4) {
          // todayExtraRows
          return { from: () => ({ where: vi.fn().mockResolvedValue([]) }) };
        }
        if (selectIndex === 5) {
          // monthBlogLinks = 250
          return { from: () => ({ where: vi.fn().mockResolvedValue([{ count: 250 }]) }) };
        }
        // monthExtras = 50 => total = 300 >= cap 300
        return { from: () => ({ where: vi.fn().mockResolvedValue([{ count: 50 }]) }) };
      }),
    });

    const tickRes = await runExtraXTick({ nowOverride: now });
    expect(tickRes.posted).toBe(0);
    expect(tickRes.skipped).toBe(1);
    expect(mockPostRawTextToX).not.toHaveBeenCalled();
    expect(updatedStatuses.some((u) => u.status === "skipped")).toBe(true);
  });

  it("never promotes an article within xNoRepeatDays", async () => {
    const now = new Date("2026-11-28T10:00:00Z");
    let callNum = 0;

    mockGetDb.mockReturnValue({
      select: vi.fn(() => {
        callNum++;
        if (callNum === 1) {
          // recent x_slots
          return { from: () => ({ where: vi.fn().mockResolvedValue([{ postId: "post-a" }]) }) };
        }
        if (callNum === 2) {
          // recent blog X posts
          return { from: () => ({ where: vi.fn().mockResolvedValue([{ id: "post-b" }]) }) };
        }
        if (callNum === 3) {
          // candidate articles excluding post-a and post-b -> none left
          return {
            from: () => ({
              where: () => ({
                orderBy: () => ({
                  limit: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          };
        }
        return { from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([]) }) }) };
      }),
    });

    const chosen = await pickPromoArticleForX(14, now);
    expect(chosen).toBeNull();
  });
});

