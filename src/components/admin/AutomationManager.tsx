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

function computeSlotPreview(
  count: number,
  windowStart: string,
  windowEnd: string,
  jitterMinutes: number,
  mode: "auto_distribute" | "fixed_times",
  fixedTimes: string[],
): string[] {
  if (count <= 0) return [];
  if (mode === "fixed_times") {
    return fixedTimes.map((t) => `${t} UTC`);
  }

  const [startH, startM] = windowStart.split(":").map(Number);
  const [endH, endM] = windowEnd.split(":").map(Number);
  const startMinutes = (startH || 0) * 60 + (startM || 0);
  const endMinutes = (endH || 0) * 60 + (endM || 0);
  const windowSpan = Math.max(1, endMinutes - startMinutes);
  const step = count > 1 ? windowSpan / (count - 1) : windowSpan / 2;

  const results: string[] = [];
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
    const h = String(Math.floor(targetMinute / 60)).padStart(2, "0");
    const m = String(targetMinute % 60).padStart(2, "0");
    results.push(`${h}:${m} UTC`);
  }
  return results;
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
    setSaving(true);
    setStatusMsg(null);
    try {
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
            maxPostsPerRun,
          },
        }),
      });

      if (!res.ok) throw new Error("Failed to update settings");
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
              <label className="block text-xs font-medium text-foreground-muted mb-1.5">
                Max Posts Per Run
              </label>
              <input
                type="number"
                min={1}
                max={5}
                value={maxPostsPerRun}
                onChange={(e) => setMaxPostsPerRun(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-surface-muted border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-border flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
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
                Configured Daily Slots ({dynamicSlots.length})
              </h3>
              <span className="text-[10px] text-foreground-muted">Live Preview</span>
            </div>
            {dynamicSlots.length === 0 ? (
              <p className="text-xs text-foreground-muted">
                No slots configured
              </p>
            ) : (
              <ul className="space-y-1.5">
                {dynamicSlots.map((time, idx) => (
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
              Tomorrow&apos;s Planned Slots ({dynamicSlots.length})
            </h3>
            {dynamicSlots.length === 0 ? (
              <p className="text-xs text-foreground-muted">
                No slots scheduled
              </p>
            ) : (
              <ul className="space-y-1.5">
                {dynamicSlots.map((time, idx) => (
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
