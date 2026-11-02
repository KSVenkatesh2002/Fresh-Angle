import { describe, it, expect } from "vitest";
import { calculateDaySlotTimes } from "../src/services/scheduling/slots";

describe("Scheduling and Slot Generation", () => {
  const defaultSettings = {
    mode: "auto_distribute" as const,
    postsPerDay: 3,
    windowStart: "09:00",
    windowEnd: "18:00",
    fixedTimes: ["10:00", "14:00", "19:00"],
    weekdays: [1, 2, 3, 4, 5], // Mon-Fri
    weekdayOverrides: {},
    jitterMinutes: 0,
    timezone: "Asia/Kolkata",
  };

  it("generates evenly distributed slots between window start and end in auto_distribute mode", () => {
    // 2026-11-04 is Wednesday (weekday 3)
    const slots = calculateDaySlotTimes("2026-11-04", defaultSettings);

    expect(slots).toHaveLength(3);
    // First slot at 09:00 UTC
    expect(slots[0].getUTCHours()).toBe(9);
    expect(slots[0].getUTCMinutes()).toBe(0);
    // Middle slot at 13:30 UTC
    expect(slots[1].getUTCHours()).toBe(13);
    expect(slots[1].getUTCMinutes()).toBe(30);
    // Last slot at 18:00 UTC
    expect(slots[2].getUTCHours()).toBe(18);
    expect(slots[2].getUTCMinutes()).toBe(0);
  });

  it("generates exact times in fixed_times mode", () => {
    const slots = calculateDaySlotTimes("2026-11-04", {
      ...defaultSettings,
      mode: "fixed_times",
    });

    expect(slots).toHaveLength(3);
    expect(slots[0].getUTCHours()).toBe(10);
    expect(slots[1].getUTCHours()).toBe(14);
    expect(slots[2].getUTCHours()).toBe(19);
  });

  it("returns empty array on non-active weekdays unless date override is specified", () => {
    // 2026-11-08 is Sunday (weekday 0) which is not in weekdays [1,2,3,4,5]
    const slots = calculateDaySlotTimes("2026-11-08", defaultSettings);
    expect(slots).toHaveLength(0);
  });

  it("respects date override disabling the day", () => {
    const slots = calculateDaySlotTimes("2026-11-04", defaultSettings, {
      enabled: false,
    });
    expect(slots).toHaveLength(0);
  });

  it("respects date override post count", () => {
    const slots = calculateDaySlotTimes("2026-11-04", defaultSettings, {
      enabled: true,
      postsCount: 5,
    });
    expect(slots).toHaveLength(5);
  });
});
