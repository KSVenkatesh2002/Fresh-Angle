export interface ScheduledEvent {
  cron: string;
  type: string;
  scheduledTime: number;
}

export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

export interface WorkerKVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete?(key: string): Promise<void>;
}

export interface Env {
  // Config vars (from wrangler.jsonc)
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  GITHUB_WORKFLOW: string;
  GITHUB_REF: string;

  // Secrets (configured via `wrangler secret put`, NEVER stored in repo)
  GITHUB_DISPATCH_TOKEN: string;
  TRIGGER_SECRET?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;

  // KV Namespace binding for durable outage alert deduplication
  ALERT_KV?: WorkerKVNamespace;
}

interface DispatchResult {
  success: boolean;
  status: number;
  message: string;
}

export const OUTAGE_ALERT_KV_KEY = "last_outage_alert";
export const OUTAGE_ALERT_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours
export const OUTAGE_ALERT_FALLBACK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour fallback when KV missing
export const OUTAGE_ALERT_TTL_SECONDS = 7200; // 2 hours (Cloudflare KV TTL)
export const OUTAGE_GAP_THRESHOLD_MINUTES = 90;

// In-memory fallback timestamp for cases where ALERT_KV is unbound or missing
let fallbackLastAlertTimeMs = 0;

export function resetFallbackAlertTime(): void {
  fallbackLastAlertTimeMs = 0;
}

/**
 * Constant-time string equality check to prevent timing attacks.
 * Never logs or reveals secrets.
 */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBuf = enc.encode(a);
  const bBuf = enc.encode(b);
  if (aBuf.byteLength !== bBuf.byteLength) {
    return false;
  }

  const subtleWithTse = typeof crypto !== "undefined"
    ? (crypto.subtle as unknown as { timingSafeEqual?: (x: ArrayBufferView, y: ArrayBufferView) => boolean })
    : undefined;

  if (typeof subtleWithTse?.timingSafeEqual === "function") {
    return subtleWithTse.timingSafeEqual(aBuf, bBuf);
  }

  // Fallback constant-time comparison
  let mismatch = 0;
  for (let i = 0; i < aBuf.byteLength; i++) {
    mismatch |= aBuf[i] ^ bBuf[i];
  }
  return mismatch === 0;
}

/**
 * Pure evaluation function: determines whether an outage alert should be sent.
 * - Outage gap must be >= 90 minutes.
 * - Current time must be within active posting window (02:30–11:30 UTC).
 * - Last alert must be >= 2 hours ago (120 minutes debounce).
 */
export function shouldSendOutageAlert(
  gapMinutes: number,
  isPostingWindow: boolean,
  lastAlertTimeMs: number,
  nowMs: number,
  minIntervalMs: number = OUTAGE_ALERT_INTERVAL_MS,
): boolean {
  if (!isPostingWindow) return false;
  if (gapMinutes < OUTAGE_GAP_THRESHOLD_MINUTES) return false;
  if (nowMs - lastAlertTimeMs < minIntervalMs) return false;
  return true;
}

/**
 * Retrieves the timestamp of the last outage alert from Workers KV.
 * Key: `last_outage_alert`.
 * Falls back to at most 1 alert per hour in memory if ALERT_KV is missing.
 */
export async function getLastOutageAlertTime(env: Env): Promise<number> {
  if (env.ALERT_KV) {
    try {
      const stored = await env.ALERT_KV.get(OUTAGE_ALERT_KV_KEY);
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed > 0) {
          return parsed;
        }
      }
    } catch (err) {
      console.warn("⚠️ [Worker] Failed to read from ALERT_KV:", err);
    }
  } else {
    console.error(
      "❌ [Worker] ALERT_KV binding is missing or not configured! Workers KV is required for cross-datacenter outage alert deduplication. Falling back to at most one alert per hour in memory.",
    );
    return fallbackLastAlertTimeMs;
  }
  return 0;
}

/**
 * Records that an outage alert was sent, storing the timestamp in Workers KV with a 2-hour TTL.
 * Falls back to isolate memory when ALERT_KV is not configured.
 */
export async function recordOutageAlertSent(env: Env, nowMs: number): Promise<void> {
  if (env.ALERT_KV) {
    try {
      await env.ALERT_KV.put(OUTAGE_ALERT_KV_KEY, String(nowMs), {
        expirationTtl: OUTAGE_ALERT_TTL_SECONDS,
      });
      console.log(`✓ [Worker] Outage alert recorded in ALERT_KV (key: ${OUTAGE_ALERT_KV_KEY}, TTL: 2h)`);
    } catch (err) {
      console.warn("⚠️ [Worker] Failed to write to ALERT_KV:", err);
    }
  } else {
    fallbackLastAlertTimeMs = nowMs;
    console.warn(`⚠️ [Worker] Recorded outage alert in local fallback memory (timestamp: ${nowMs})`);
  }
}

/**
 * Sends a notification message to Telegram if credentials are configured.
 */
async function sendTelegramAlert(
  env: Env,
  text: string,
): Promise<boolean> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    return res.ok;
  } catch (err) {
    console.error("⚠️ [Worker] Failed to send Telegram alert:", err);
    return false;
  }
}

/**
 * Dispatches the GitHub Actions tick.yml workflow via REST API.
 * Includes automatic retry on 5xx / network failures.
 */
async function dispatchGitHubWorkflow(env: Env): Promise<DispatchResult> {
  const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/actions/workflows/${env.GITHUB_WORKFLOW}/dispatches`;

  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`,
    "User-Agent": "Cloudflare-Worker-Fresh-Angle-Tick",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };

  const payload = JSON.stringify({
    ref: env.GITHUB_REF || "main",
  });

  // Attempt 1
  try {
    const res = await fetch(url, { method: "POST", headers, body: payload });
    if (res.status === 204) {
      return { success: true, status: 204, message: "Dispatched successfully" };
    }

    const text = await res.text();
    console.warn(`⚠️ [Worker] Attempt 1 failed (HTTP ${res.status}): ${text}`);

    // If 5xx error or transient network issue, retry once after 3 seconds
    if (res.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const retryRes = await fetch(url, { method: "POST", headers, body: payload });
      if (retryRes.status === 204) {
        return { success: true, status: 204, message: "Dispatched successfully on retry" };
      }
      const retryText = await retryRes.text();
      return { success: false, status: retryRes.status, message: retryText };
    }

    return { success: false, status: res.status, message: text };
  } catch (err: unknown) {
    const errorMsg = (err as Error).message || "Network error";
    console.error("❌ [Worker] Dispatch error:", errorMsg);

    // Retry once
    try {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const retryRes = await fetch(url, { method: "POST", headers, body: payload });
      if (retryRes.status === 204) {
        return { success: true, status: 204, message: "Dispatched successfully on retry" };
      }
      const retryText = await retryRes.text();
      return { success: false, status: retryRes.status, message: retryText };
    } catch (retryErr: unknown) {
      const retryErrorMsg = (retryErr as Error).message || "Retry network error";
      return { success: false, status: 500, message: retryErrorMsg };
    }
  }
}

/**
 * Checks for scheduler disruption during active posting window.
 * Posting window: 02:30 to 11:30 UTC (08:00 to 17:00 IST).
 * Debounced: uses Cloudflare Workers KV (last_outage_alert) with a 2-hour TTL.
 */
async function checkPostingWindowDisruption(env: Env): Promise<void> {
  const now = new Date();
  const utcMinute = now.getUTCHours() * 60 + now.getUTCMinutes();
  const isPostingWindow = utcMinute >= 150 && utcMinute <= 690; // 02:30 to 11:30 UTC

  if (!isPostingWindow) {
    return;
  }

  try {
    const runsUrl = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/actions/workflows/${env.GITHUB_WORKFLOW}/runs?status=completed&per_page=1`;
    const res = await fetch(runsUrl, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`,
        "User-Agent": "Cloudflare-Worker-Fresh-Angle-Tick",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!res.ok) return;

    const data = (await res.json()) as { workflow_runs?: Array<{ created_at: string; conclusion: string }> };
    const latestRun = data.workflow_runs?.[0];

    if (latestRun?.created_at) {
      const latestRunTime = new Date(latestRun.created_at).getTime();
      const gapMinutes = Math.floor((now.getTime() - latestRunTime) / (60 * 1000));
      const lastAlertTime = await getLastOutageAlertTime(env);

      const minInterval = env.ALERT_KV ? OUTAGE_ALERT_INTERVAL_MS : OUTAGE_ALERT_FALLBACK_INTERVAL_MS;

      if (shouldSendOutageAlert(gapMinutes, isPostingWindow, lastAlertTime, now.getTime(), minInterval)) {
        const sent = await sendTelegramAlert(
          env,
          `🚨 <b>[Fresh Angle] Scheduler Disruption Warning</b>\n\n` +
          `⚠️ No GitHub Actions workflow run has completed in <b>${gapMinutes} minutes</b> during the active posting window (02:30–11:30 UTC).\n\n` +
          `Worker cron is dispatching a new tick now. (${env.ALERT_KV ? "Next reminder in 2 hours" : "Fallback reminder in 1 hour"} if outage continues)`,
        );

        if (sent) {
          await recordOutageAlertSent(env, now.getTime());
        }
      } else if (gapMinutes >= OUTAGE_GAP_THRESHOLD_MINUTES) {
        console.log(`⏱️ [Worker] Outage alert suppressed (ALERT_KV 2h dedupe active; last alert: ${new Date(lastAlertTime).toISOString()})`);
      }
    }
  } catch (err) {
    console.warn("⚠️ [Worker] Disruption check error:", err);
  }
}

export default {
  /**
   * Cloudflare Cron Trigger Handler
   */
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    console.log(`⏱️ [Worker] Scheduled trigger fired at ${new Date().toISOString()} (cron: ${event.cron})`);

    // Check for prolonged tick absence during posting window (debounced at most once per 2h via ALERT_KV)
    ctx.waitUntil(checkPostingWindowDisruption(env));

    // Dispatch the tick workflow
    const result = await dispatchGitHubWorkflow(env);

    if (!result.success) {
      console.error(`❌ [Worker] Scheduled dispatch failed: ${result.message}`);
      await sendTelegramAlert(
        env,
        `🚨 <b>[Fresh Angle] Worker Dispatch Failed!</b>\n\n` +
        `HTTP Status: ${result.status}\n` +
        `Error: <code>${result.message.slice(0, 300)}</code>`,
      );
    } else {
      console.log("✓ [Worker] Scheduled dispatch succeeded (HTTP 204)");
    }
  },

  /**
   * Cloudflare HTTP Fetch Handler
   * - GET /health
   * - POST /trigger with header 'X-Trigger-Secret' (constant-time verification)
   */
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    // 1. Health check endpoint
    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          status: "ok",
          worker: "fresh-angle-tick-trigger",
          timestamp: new Date().toISOString(),
          repo: `${env.GITHUB_OWNER}/${env.GITHUB_REPO}`,
          workflow: env.GITHUB_WORKFLOW,
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    // 2. Manual trigger endpoint: POST only, X-Trigger-Secret header only
    if (url.pathname === "/trigger") {
      if (request.method !== "POST") {
        return new Response(
          JSON.stringify({ error: "Method Not Allowed. Use POST with X-Trigger-Secret header." }),
          {
            headers: { "Content-Type": "application/json", Allow: "POST" },
            status: 405,
          },
        );
      }

      const receivedSecret = request.headers.get("x-trigger-secret") || "";

      if (!env.TRIGGER_SECRET || !receivedSecret || !timingSafeEqualStr(receivedSecret, env.TRIGGER_SECRET)) {
        return new Response(
          JSON.stringify({ error: "Unauthorized: Invalid or missing trigger secret" }),
          {
            headers: { "Content-Type": "application/json" },
            status: 401,
          },
        );
      }

      console.log("🚀 [Worker] Authenticated manual trigger dispatched via POST");
      const result = await dispatchGitHubWorkflow(env);

      if (!result.success) {
        return new Response(
          JSON.stringify({
            success: false,
            status: result.status,
            error: result.message,
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 502,
          },
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          status: 204,
          message: "Workflow tick.yml dispatched successfully to GitHub Actions",
          dispatchedAt: new Date().toISOString(),
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    // Default 404
    return new Response(
      JSON.stringify({
        error: "Not Found",
        availableRoutes: [
          "GET /health",
          "POST /trigger (Header: X-Trigger-Secret)",
        ],
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 404,
      },
    );
  },
};
