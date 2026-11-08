"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AutomationSettings } from "@/db/schema";
import {
  Play,
  Pause,
  RefreshCw,
  Sparkles,
  Check,
  AlertTriangle,
} from "lucide-react";

interface AutomationManagerProps {
  initialSettings: AutomationSettings;
  todaySlots: string[];
  tomorrowSlots: string[];
}

interface SlotPreviewResult {
  slots: string[];
  minGapMinutes: number;
  nominalGap: number;
  windowSpan: number;
  isValid: boolean;
}

function computeSlotPreview(
  count: number,
  windowStart: string,
  windowEnd: string,
  jitterMinutes: number,
  mode: "auto_distribute" | "fixed_times",
  fixedTimes: string[],
): SlotPreviewResult {
  if (count <= 0) {
    return { slots: [], minGapMinutes: 0, nominalGap: 0, windowSpan: 0, isValid: true };
  }

  if (mode === "fixed_times") {
    const slots = fixedTimes.map((t) => `${t} UTC`);
    return { slots, minGapMinutes: 60, nominalGap: 60, windowSpan: 1440, isValid: true };
  }

  const [startH, startM] = windowStart.split(":").map(Number);
  const [endH, endM] = windowEnd.split(":").map(Number);
  const startMinutes = (startH || 0) * 60 + (startM || 0);
  const endMinutes = (endH || 0) * 60 + (endM || 0);
  const windowSpan = endMinutes - startMinutes;

  if (windowSpan <= 0) {
    return { slots: [], minGapMinutes: 0, nominalGap: 0, windowSpan, isValid: false };
  }

  const nominalGap = count > 1 ? windowSpan / (count - 1) : windowSpan;
  const step = count > 1 ? windowSpan / (count - 1) : windowSpan / 2;

  const minutes: number[] = [];
  for (let i = 0; i < count; i++) {
    let targetMinute = Math.round(startMinutes + i * step);
    if (jitterMinutes > 0) {
      const jitterVal =
        ((i * 17 + 3) % (jitterMinutes * 2 + 1)) - jitterMinutes;
      targetMinute = Math.max(
        startMinutes,
        Math.min(endMinutes, targetMinute + jitterVal),
      );
    }
    minutes.push(targetMinute);
  }

  minutes.sort((a, b) => a - b);

  // Enforce spacing algorithm: minimum desired gap 45 minutes
  const minDesiredGap =
    count > 1 ? Math.min(45, Math.floor((windowSpan / (count - 1)) * 0.6)) : 0;

  if (minDesiredGap > 0) {
    for (let i = 1; i < count; i++) {
      if (minutes[i] - minutes[i - 1] < minDesiredGap) {
        minutes[i] = minutes[i - 1] + minDesiredGap;
      }
    }
    if (minutes[count - 1] > endMinutes) {
      minutes[count - 1] = endMinutes;
      for (let i = count - 2; i >= 0; i--) {
        if (minutes[i + 1] - minutes[i] < minDesiredGap) {
          minutes[i] = minutes[i + 1] - minDesiredGap;
        }
      }
    }
  }

  let minGapMinutes = Infinity;
  for (let i = 1; i < minutes.length; i++) {
    const gap = minutes[i] - minutes[i - 1];
    if (gap < minGapMinutes) minGapMinutes = gap;
  }
  if (minGapMinutes === Infinity) minGapMinutes = windowSpan;

  const slots = minutes.map((mTotal) => {
    const h = String(Math.floor(mTotal / 60)).padStart(2, "0");
    const m = String(mTotal % 60).padStart(2, "0");

    // Convert to IST (+5h 30m)
    const istTotal = (mTotal + 330) % 1440;
    const istH = String(Math.floor(istTotal / 60)).padStart(2, "0");
    const istM = String(istTotal % 60).padStart(2, "0");

    return `${h}:${m} UTC · ${istH}:${istM} IST`;
  });

  return {
    slots,
    minGapMinutes,
    nominalGap,
    windowSpan,
    isValid: nominalGap >= 45 && windowSpan > 0,
  };
}

export function AutomationManager({
  initialSettings,
  todaySlots: _todaySlots,
  tomorrowSlots: _tomorrowSlots,
}: AutomationManagerProps): React.JSX.Element {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialSettings.enabled);
  const [mode, setMode] = useState(initialSettings.mode);
  const [postsPerDay, setPostsPerDay] = useState(initialSettings.postsPerDay);
  const [windowStart, setWindowStart] = useState(initialSettings.windowStart);
  const [windowEnd, setWindowEnd] = useState(initialSettings.windowEnd);
  const [jitterMinutes, setJitterMinutes] = useState(
    initialSettings.jitterMinutes,
  );
  const [publishMode, setPublishMode] = useState(initialSettings.publishMode);
  const [contentMode, setContentMode] = useState(initialSettings.contentMode);
  const [maxPostsPerRun, setMaxPostsPerRun] = useState(
    initialSettings.maxPostsPerRun,
  );

  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [triggeringTick, setTriggeringTick] = useState(false);
  const [generatingNow, setGeneratingNow] = useState(false);

  const dynamicSlots = useMemo(() => {
    return computeSlotPreview(
      postsPerDay,
      windowStart,
      windowEnd,
      jitterMinutes,
      mode,
      initialSettings.fixedTimes || [],
    );
  }, [
    postsPerDay,
    windowStart,
    windowEnd,
    jitterMinutes,
    mode,
    initialSettings.fixedTimes,
  ]);

  async function handleSave(): Promise<void> {
    if (mode === "auto_distribute" && !dynamicSlots.isValid) {
      setStatusMsg({
        type: "error",
        text: `Cannot save: window is too narrow for ${postsPerDay} posts. Span is ${dynamicSlots.windowSpan}m, giving ~${Math.round(dynamicSlots.nominalGap)}m spacing between slots (minimum allowed spacing is 45m).`,
      });
      return;
    }

    setSaving(true);
    setStatusMsg(null);
    try {
      const clampedMaxPosts = Math.max(1, Math.min(3, maxPostsPerRun || 1));
      const res = await fetch("/api/admin/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_settings",
          settings: {
            enabled,
            mode,
            postsPerDay,
            windowStart,
            windowEnd,
            jitterMinutes,
            publishMode,
            contentMode,
            maxPostsPerRun: clampedMaxPosts,
          },
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to update settings");
      }
      setStatusMsg({
        type: "success",
        text: "Automation parameters saved successfully! Slots synchronized.",
      });
      router.refresh();
    } catch (err) {
      setStatusMsg({ type: "error", text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function handleRunTick(): Promise<void> {
    setTriggeringTick(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/admin/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run_tick" }),
      });
      const data = await res.json();
      setStatusMsg({
        type: "success",
        text: data.result?.message || "Tick executed successfully",
      });
    } catch (err) {
      setStatusMsg({ type: "error", text: (err as Error).message });
    } finally {
      setTriggeringTick(false);
    }
  }

  async function handleGenerateNow(): Promise<void> {
    setGeneratingNow(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/admin/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate_now" }),
      });
      const data = await res.json();
      setStatusMsg({
        type: "success",
        text: data.message || "Generation initiated",
      });
    } catch (err) {
      setStatusMsg({ type: "error", text: (err as Error).message });
    } finally {
      setGeneratingNow(false);
    }
  }

  return (
    <div className="space-y-6">
      {statusMsg && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-center gap-2 ${
            statusMsg.type === "success"
              ? "bg-surface border-success/40 text-success"
              : "bg-surface border-danger/40 text-danger"
          }`}
        >
          {statusMsg.type === "success" ? (
            <Check className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Primary Actions Bar */}
      <div className="p-5 rounded-2xl bg-surface border border-border flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setEnabled(!enabled)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors ${
              enabled
                ? "bg-success/15 text-success border border-success/30 hover:bg-success/20"
                : "bg-surface-muted text-foreground-muted border border-border hover:bg-surface"
            }`}
          >
            {enabled ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            <span>
              Engine: {enabled ? "Active / Running" : "Paused / Stopped"}
            </span>
          </button>
          <span className="text-xs text-foreground-muted">
            Timezone: <strong>{initialSettings.timezone}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRunTick}
            disabled={triggeringTick}
            className="px-3.5 py-2 rounded-xl border border-border bg-surface-muted hover:border-primary text-xs font-medium text-foreground flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${triggeringTick ? "animate-spin" : ""}`}
            />
            <span>Run Tick Now</span>
          </button>

          <button
            type="button"
            onClick={handleGenerateNow}
            disabled={generatingNow}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{generatingNow ? "Generating..." : "Generate One Now"}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Form */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-surface border border-border space-y-5">
          <h2 className="text-base font-bold text-foreground">
            Schedule Configuration
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-foreground-muted mb-1.5">
                Distribution Mode
              </label>
              <select
                value={mode}
                onChange={(e) =>
                  setMode(e.target.value as "auto_distribute" | "fixed_times")
                }
                className="w-full px-3 py-2 rounded-lg bg-surface-muted border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="auto_distribute">
                  Auto-Distribute (Even Spacing)
                </option>
                <option value="fixed_times">Fixed Daily Times</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground-muted mb-1.5">
                Target Posts Per Day: <strong>{postsPerDay}</strong>
              </label>
              <input
                type="range"
                min={1}
                max={12}
                value={postsPerDay}
                onChange={(e) => setPostsPerDay(Number(e.target.value))}
                className="w-full h-2 rounded bg-surface-muted accent-primary cursor-pointer mt-2"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground-muted mb-1.5">
                Window Start Time
              </label>
              <input
                type="time"
                value={windowStart}
                onChange={(e) => setWindowStart(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-surface-muted border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground-muted mb-1.5">
                Window End Time
              </label>
              <input
                type="time"
                value={windowEnd}
                onChange={(e) => setWindowEnd(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-surface-muted border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground-muted mb-1.5">
                Jitter (+/- minutes)
              </label>
              <input
                type="number"
                min={0}
                max={60}
                value={jitterMinutes}
                onChange={(e) => setJitterMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-surface-muted border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground-muted mb-1.5">
                Publishing Mode
              </label>
              <select
                value={publishMode}
                onChange={(e) =>
                  setPublishMode(e.target.value as "auto" | "review")
                }
                className="w-full px-3 py-2 rounded-lg bg-surface-muted border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="auto">Auto-Publish Immediately</option>
                <option value="review">Review Queue (Save as Draft)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground-muted mb-1.5">
                Content Selection Mode
              </label>
              <select
                value={contentMode}
                onChange={(e) =>
                  setContentMode(
                    e.target.value as
                      "trending" | "evergreen" | "queue_only" | "mixed",
                  )
                }
                className="w-full px-3 py-2 rounded-lg bg-surface-muted border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="trending">Current Trending Stories</option>
                <option value="queue_only">Topic Queue Only</option>
                <option value="mixed">
                  Mixed (Queue Priority then Trending)
                </option>
                <option value="evergreen">
                  Evergreen Architectural Guides
                </option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-foreground-muted">
                  Max Posts Per Run
                </label>
                <span className="text-[10px] text-foreground-muted">Allowed: 1 – 3</span>
              </div>
              <input
                type="number"
                min={1}
                max={3}
                value={maxPostsPerRun}
                onChange={(e) =>
                  setMaxPostsPerRun(
                    Math.max(1, Math.min(3, Number(e.target.value) || 1)),
                  )
                }
                className="w-full px-3 py-2 rounded-lg bg-surface-muted border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-border flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || (mode === "auto_distribute" && !dynamicSlots.isValid)}
              className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Parameters"}
            </button>
          </div>
        </div>

        {/* Live Slot Preview Card */}
        <div className="p-6 rounded-2xl bg-surface-muted border border-border space-y-5">
          <h2 className="text-base font-bold text-foreground">
            Live Slot Preview
          </h2>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">
                Configured Daily Slots ({dynamicSlots.slots.length})
              </h3>
              <span className="text-[10px] text-foreground-muted">Live Preview</span>
            </div>

            {mode === "auto_distribute" && (
              <div className="p-3 rounded-xl bg-surface border border-border space-y-2 text-xs">
                <div className="flex items-center justify-between text-foreground-muted">
                  <span>Window Span:</span>
                  <strong className="text-foreground font-mono">
                    {dynamicSlots.windowSpan}m ({windowStart} – {windowEnd})
                  </strong>
                </div>
                <div className="flex items-center justify-between text-foreground-muted">
                  <span>Average Slot Gap:</span>
                  <strong className="text-foreground font-mono">
                    ~{Math.round(dynamicSlots.nominalGap)}m
                  </strong>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-border">
                  <span className="font-semibold text-foreground">
                    Minimum Slot Gap:
                  </span>
                  <strong
                    className={`font-mono font-bold ${dynamicSlots.isValid ? "text-success" : "text-destructive"}`}
                  >
                    {dynamicSlots.minGapMinutes} min{" "}
                    {dynamicSlots.isValid ? "✓ (>= 45m)" : "✕ (< 45m)"}
                  </strong>
                </div>

                {!dynamicSlots.isValid && (
                  <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-[11px] leading-relaxed">
                    ⚠️ <strong>Window Too Narrow:</strong> {dynamicSlots.windowSpan}m
                    across {postsPerDay} posts yields only ~
                    {Math.round(dynamicSlots.nominalGap)}m spacing. Minimum allowed
                    spacing is 45 minutes. Please expand the window or decrease
                    posts per day before saving.
                  </div>
                )}
              </div>
            )}

            {dynamicSlots.slots.length === 0 ? (
              <p className="text-xs text-foreground-muted">
                No slots configured
              </p>
            ) : (
              <ul className="space-y-1.5">
                {dynamicSlots.slots.map((time, idx) => (
                  <li
                    key={idx}
                    className="p-2 rounded-lg bg-surface border border-border text-xs text-foreground flex items-center justify-between"
                  >
                    <span>Slot #{idx + 1}</span>
                    <strong className="font-mono text-primary">{time}</strong>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-3 pt-3 border-t border-border">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
              Tomorrow&apos;s Planned Slots ({dynamicSlots.slots.length})
            </h3>
            {dynamicSlots.slots.length === 0 ? (
              <p className="text-xs text-foreground-muted">
                No slots scheduled
              </p>
            ) : (
              <ul className="space-y-1.5">
                {dynamicSlots.slots.map((time, idx) => (
                  <li
                    key={idx}
                    className="p-2 rounded-lg bg-surface border border-border text-xs text-foreground flex items-center justify-between"
                  >
                    <span>Slot #{idx + 1}</span>
                    <strong className="font-mono text-foreground-muted">
                      {time}
                    </strong>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
