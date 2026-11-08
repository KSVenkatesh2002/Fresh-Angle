import { describe, it, expect } from "vitest";
import {
  shouldSendOutageAlert,
  timingSafeEqualStr,
  getLastOutageAlertTime,
  recordOutageAlertSent,
  OUTAGE_ALERT_INTERVAL_MS,
  OUTAGE_ALERT_KV_KEY,
  OUTAGE_ALERT_TTL_SECONDS,
  Env,
  WorkerKVNamespace,
} from "../cloudflare-worker/src/index";

/**
 * Creates an in-memory mock of Cloudflare Workers KV namespace.
 */
function createMockKV(): WorkerKVNamespace & { store: Map<string, { value: string; expiresAt?: number }> } {
  const store = new Map<string, { value: string; expiresAt?: number }>();

  return {
    store,
    async get(key: string): Promise<string | null> {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
      const expiresAt = options?.expirationTtl
        ? Date.now() + options.expirationTtl * 1000
        : undefined;
      store.set(key, { value, expiresAt });
    },
    async delete(key: string): Promise<void> {
      store.delete(key);
    },
  };
}

describe("Cloudflare Worker Watchdog & Outage Alert Deduplication via Workers KV", () => {
  const BASE_TIME = new Date("2026-11-08T05:00:00.000Z").getTime(); // 05:00 UTC (inside 02:30–11:30 posting window)

  describe("Outage Alert Cooldown (Pure Function)", () => {
    it("triggers alert on first outage detection when gap is >= 90 minutes", () => {
      const gapMinutes = 90;
      const isPostingWindow = true;
      const lastAlertTimeMs = 0; // Never alerted before
      const nowMs = BASE_TIME;

      const shouldAlert = shouldSendOutageAlert(
        gapMinutes,
        isPostingWindow,
        lastAlertTimeMs,
        nowMs,
      );

      expect(shouldAlert).toBe(true);
    });

    it("suppresses repeated alerts on subsequent 15-minute cron ticks during an ongoing outage", () => {
      const isPostingWindow = true;
      const initialAlertTime = BASE_TIME;

      // Tick 1 (15 mins later): gap is now 105 mins
      const tick1Time = initialAlertTime + 15 * 60 * 1000;
      expect(
        shouldSendOutageAlert(105, isPostingWindow, initialAlertTime, tick1Time),
      ).toBe(false);

      // Tick 2 (30 mins later): gap is now 120 mins
      const tick2Time = initialAlertTime + 30 * 60 * 1000;
      expect(
        shouldSendOutageAlert(120, isPostingWindow, initialAlertTime, tick2Time),
      ).toBe(false);

      // Tick 4 (60 mins later): gap is now 150 mins
      const tick4Time = initialAlertTime + 60 * 60 * 1000;
      expect(
        shouldSendOutageAlert(150, isPostingWindow, initialAlertTime, tick4Time),
      ).toBe(false);

      // Tick 7 (105 mins later): gap is now 195 mins
      const tick7Time = initialAlertTime + 105 * 60 * 1000;
      expect(
        shouldSendOutageAlert(195, isPostingWindow, initialAlertTime, tick7Time),
      ).toBe(false);
    });

    it("allows a reminder alert once exactly 2 hours (120 minutes) have elapsed", () => {
      const isPostingWindow = true;
      const initialAlertTime = BASE_TIME;
      const twoHoursLater = initialAlertTime + OUTAGE_ALERT_INTERVAL_MS; // +120 minutes

      expect(
        shouldSendOutageAlert(210, isPostingWindow, initialAlertTime, twoHoursLater),
      ).toBe(true);
    });

    it("does not trigger alert if gap is under threshold (< 90 mins)", () => {
      expect(
        shouldSendOutageAlert(75, true, 0, BASE_TIME),
      ).toBe(false);
    });

    it("does not trigger alert outside active posting window", () => {
      expect(
        shouldSendOutageAlert(120, false, 0, BASE_TIME),
      ).toBe(false);
    });
  });

  describe("Workers KV Storage Persistence & Repeated Cron Simulation", () => {
    it("persists alert timestamp in Workers KV with 2-hour TTL and blocks repeated cron ticks", async () => {
      const mockKV = createMockKV();
      const mockEnv: Env = {
        GITHUB_OWNER: "KSVenkatesh2002",
        GITHUB_REPO: "Fresh-Angle",
        GITHUB_WORKFLOW: "tick.yml",
        GITHUB_REF: "main",
        GITHUB_DISPATCH_TOKEN: "mock_pat",
        ALERT_KV: mockKV,
      };

      // T=0: Initial state - KV is empty
      const initialLastAlert = await getLastOutageAlertTime(mockEnv);
      expect(initialLastAlert).toBe(0);

      // Simulate Cron Tick #1 at T=90m: Outage detected, first alert sent
      const tick0Time = BASE_TIME;
      const gap0 = 90;
      const shouldAlert0 = shouldSendOutageAlert(gap0, true, initialLastAlert, tick0Time);
      expect(shouldAlert0).toBe(true);

      // Alert sent -> record to Workers KV
      await recordOutageAlertSent(mockEnv, tick0Time);

      // Verify KV entry
      const kvValue = await mockKV.get(OUTAGE_ALERT_KV_KEY);
      expect(kvValue).toBe(String(tick0Time));

      let alertsSent = 1;

      // Simulate Cron Ticks every 15 minutes for the next 105 minutes (7 ticks)
      // Ticks at +15m, +30m, +45m, +60m, +75m, +90m, +105m
      for (let min = 15; min <= 105; min += 15) {
        const cronTime = tick0Time + min * 60 * 1000;
        const currentGap = 90 + min;

        // Worker queries KV for last alert time
        const storedLastAlert = await getLastOutageAlertTime(mockEnv);
        expect(storedLastAlert).toBe(tick0Time);

        // Evaluate whether to alert
        const shouldAlert = shouldSendOutageAlert(currentGap, true, storedLastAlert, cronTime);

        // MUST be suppressed
        expect(shouldAlert).toBe(false);
        if (shouldAlert) alertsSent++;
      }

      // Across 8 ticks (2 hours of continuous outage), exactly 1 alert was sent!
      expect(alertsSent).toBe(1);

      // Simulate Cron Tick at T=120m (2 hours later)
      const tickTwoHoursLater = tick0Time + 120 * 60 * 1000;
      const storedLastAlert = await getLastOutageAlertTime(mockEnv);
      const shouldAlertTwoHours = shouldSendOutageAlert(210, true, storedLastAlert, tickTwoHoursLater);

      // Cooldown expired -> Reminder alert is permitted
      expect(shouldAlertTwoHours).toBe(true);
      if (shouldAlertTwoHours) {
        await recordOutageAlertSent(mockEnv, tickTwoHoursLater);
        alertsSent++;
      }

      expect(alertsSent).toBe(2);
    });

    it("falls back to at most 1 alert per hour when ALERT_KV is missing/unbound", async () => {
      const { resetFallbackAlertTime, OUTAGE_ALERT_FALLBACK_INTERVAL_MS } = await import("../cloudflare-worker/src/index");
      resetFallbackAlertTime();

      const envWithoutKV: Env = {
        GITHUB_OWNER: "KSVenkatesh2002",
        GITHUB_REPO: "Fresh-Angle",
        GITHUB_WORKFLOW: "tick.yml",
        GITHUB_REF: "main",
        GITHUB_DISPATCH_TOKEN: "mock_pat",
        ALERT_KV: undefined, // Missing binding
      };

      // T=0: Initial state without KV
      const initialLastAlert = await getLastOutageAlertTime(envWithoutKV);
      expect(initialLastAlert).toBe(0);

      // Tick at T=0 (90m gap): First alert sent
      const tick0Time = BASE_TIME;
      const shouldAlert0 = shouldSendOutageAlert(
        90,
        true,
        initialLastAlert,
        tick0Time,
        OUTAGE_ALERT_FALLBACK_INTERVAL_MS,
      );
      expect(shouldAlert0).toBe(true);
      await recordOutageAlertSent(envWithoutKV, tick0Time);

      // Subsequent 15-minute cron ticks at +15m, +30m, +45m MUST be suppressed by fallback memory
      for (const min of [15, 30, 45]) {
        const cronTime = tick0Time + min * 60 * 1000;
        const storedLastAlert = await getLastOutageAlertTime(envWithoutKV);
        expect(storedLastAlert).toBe(tick0Time);

        const shouldAlert = shouldSendOutageAlert(
          90 + min,
          true,
          storedLastAlert,
          cronTime,
          OUTAGE_ALERT_FALLBACK_INTERVAL_MS,
        );
        expect(shouldAlert).toBe(false);
      }

      // At +60m (1 hour later): Fallback cooldown expired, alert is permitted
      const oneHourLater = tick0Time + 60 * 60 * 1000;
      const storedLastAlert60 = await getLastOutageAlertTime(envWithoutKV);
      const shouldAlert60 = shouldSendOutageAlert(
        150,
        true,
        storedLastAlert60,
        oneHourLater,
        OUTAGE_ALERT_FALLBACK_INTERVAL_MS,
      );
      expect(shouldAlert60).toBe(true);
    });
  });

  describe("Constant-Time String Comparison (timingSafeEqualStr)", () => {
    const validSecret = "cf_sec_9f8a3b127e4d6c5a0b8e";

    it("returns true for matching secrets", () => {
      expect(timingSafeEqualStr(validSecret, validSecret)).toBe(true);
    });

    it("returns false for different lengths without throwing", () => {
      expect(timingSafeEqualStr(validSecret, "short")).toBe(false);
      expect(timingSafeEqualStr("short", validSecret)).toBe(false);
      expect(timingSafeEqualStr("", validSecret)).toBe(false);
    });

    it("returns false for same length with different characters", () => {
      const corruptedSecret = validSecret.slice(0, -1) + "x";
      expect(timingSafeEqualStr(validSecret, corruptedSecret)).toBe(false);
    });
  });
});
