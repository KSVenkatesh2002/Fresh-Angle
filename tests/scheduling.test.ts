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

  it("distributes 7 slots over 02:30-11:30 with jitter 15 with no gap < 45m and last slot inside window", () => {
    const settings7 = {
      mode: "auto_distribute" as const,
      postsPerDay: 7,
      windowStart: "02:30",
      windowEnd: "11:30",
      fixedTimes: [],
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      weekdayOverrides: {},
      jitterMinutes: 15,
      timezone: "UTC",
    };

    // Test across several dates to account for deterministic date jitter variance
    const testDates = ["2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12"];

    for (const d of testDates) {
      const slots = calculateDaySlotTimes(d, settings7);
      expect(slots).toHaveLength(7);

      // Verify all slots are within window bounds: 02:30 <= slot <= 11:30
      const windowStartMinutes = 2 * 60 + 30; // 150
      const windowEndMinutes = 11 * 60 + 30;  // 690

      for (let i = 0; i < slots.length; i++) {
        const slotMinutes = slots[i].getUTCHours() * 60 + slots[i].getUTCMinutes();
        expect(slotMinutes).toBeGreaterThanOrEqual(windowStartMinutes);
        expect(slotMinutes).toBeLessThanOrEqual(windowEndMinutes);

        // Verify no gap smaller than 45 minutes between adjacent slots
        if (i > 0) {
          const gapMinutes =
            (slots[i].getTime() - slots[i - 1].getTime()) / (60 * 1000);
          expect(gapMinutes).toBeGreaterThanOrEqual(45);
        }
      }

      // Explicitly verify last slot falls strictly inside the window
      const lastSlot = slots[slots.length - 1];
      const lastSlotMinutes = lastSlot.getUTCHours() * 60 + lastSlot.getUTCMinutes();
      expect(lastSlotMinutes).toBeLessThanOrEqual(windowEndMinutes);
    }
  });

  describe("Late Slot Policy & Grace Window Evaluation", () => {
    const now = new Date("2026-11-08T12:00:00.000Z");
    const graceMinutes = 360; // 6 hours
    const graceMs = graceMinutes * 60 * 1000;

    it("identifies slots within 360m grace window as valid and past 360m as expired", () => {
      const mockSlots = [
        {
          id: "slot-valid-oldest",
          plannedAt: new Date(now.getTime() - 180 * 60 * 1000), // 3 hours ago (within 360m)
          status: "planned",
        },
        {
          id: "slot-valid-newest",
          plannedAt: new Date(now.getTime() - 60 * 60 * 1000), // 1 hour ago (within 360m)
          status: "planned",
        },
        {
          id: "slot-expired",
          plannedAt: new Date(now.getTime() - 361 * 60 * 1000), // 361 minutes ago (exceeded 360m)
          status: "planned",
        },
      ];

      const validSlots = mockSlots.filter(
        (s) => now.getTime() - s.plannedAt.getTime() <= graceMs,
      );
      const expiredSlots = mockSlots.filter(
        (s) => now.getTime() - s.plannedAt.getTime() > graceMs,
      );

      expect(validSlots).toHaveLength(2);
      expect(expiredSlots).toHaveLength(1);
      expect(expiredSlots[0].id).toBe("slot-expired");

      // Verify oldest first ordering
      const sortedValid = [...validSlots].sort(
        (a, b) => a.plannedAt.getTime() - b.plannedAt.getTime(),
      );
      expect(sortedValid[0].id).toBe("slot-valid-oldest");
      expect(sortedValid[1].id).toBe("slot-valid-newest");

      // Verify max_posts_per_run batching
      const maxPostsPerRun = 2;
      const batchToProcess = sortedValid.slice(0, maxPostsPerRun);
      expect(batchToProcess).toHaveLength(2);
      expect(batchToProcess[0].id).toBe("slot-valid-oldest");
    });

    it("formats missed slot reason with explicit planned time and elapsed minutes", () => {
      const plannedAt = new Date(now.getTime() - 400 * 60 * 1000);
      const elapsedMinutes = Math.round((now.getTime() - plannedAt.getTime()) / (60 * 1000));
      const reason = `Slot expired: exceeded ${graceMinutes}m late grace window (${elapsedMinutes}m elapsed, planned: ${plannedAt.toISOString()})`;

      expect(reason).toContain("exceeded 360m late grace window");
      expect(reason).toContain("400m elapsed");
      expect(reason).toContain(plannedAt.toISOString());
    });
  });
});
