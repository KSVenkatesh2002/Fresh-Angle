"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { XScheduleSettings, XTelemetry } from "@/services/scheduling/x-slots";
import { Save, Share2 } from "lucide-react";

interface ExtraXScheduleManagerProps {
  initialSettings: XScheduleSettings;
  initialTelemetry: XTelemetry;
  blogPostsPerDay: number;
}

export function ExtraXScheduleManager({
  initialSettings,
  initialTelemetry,
  blogPostsPerDay,
}: ExtraXScheduleManagerProps): React.JSX.Element {
  const router = useRouter();
  const [extraXPostsPerDay, setExtraXPostsPerDay] = useState(
    initialSettings.extraXPostsPerDay,
  );
  const [monthlyXCap, setMonthlyXCap] = useState(initialSettings.monthlyXCap);
  const [xWindowStart, setXWindowStart] = useState(initialSettings.xWindowStart);
  const [xWindowEnd, setXWindowEnd] = useState(initialSettings.xWindowEnd);
  const [xNoRepeatDays, setXNoRepeatDays] = useState(initialSettings.xNoRepeatDays);
  const [telemetry, setTelemetry] = useState<XTelemetry>(initialTelemetry);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );

  const totalPerDay = blogPostsPerDay + extraXPostsPerDay;

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/x-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extraXPostsPerDay,
          monthlyXCap,
          xWindowStart,
          xWindowEnd,
          xNoRepeatDays,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to save Extra X schedule");
      }
      if (data.telemetry) {
        setTelemetry(data.telemetry);
      }
      const rec = data.reconcile as
        | { created: number; cancelled: number; windowClosed: boolean }
        | undefined;
      const suffix = rec
        ? rec.windowClosed
          ? " Today's posting window is already closed; changes take effect tomorrow."
          : ` Today updated: +${rec.created} added, ${rec.cancelled} pending cancelled.`
        : "";
      setMessage({
        type: "ok",
        text: `Extra X schedule saved.${suffix}`,
      });
      router.refresh();
    } catch (err) {
      setMessage({ type: "err", text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 rounded-2xl bg-surface border border-border space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Share2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">
              Extra X Promotional Schedule
            </h2>
            <p className="text-xs text-foreground-muted">
              Blog link posts fire automatically on publish. Extra X posts promote existing articles separately ({telemetry.timezone}).
            </p>
          </div>
        </div>
        <Badge variant="outline">
          Total X posts/day = blog ({blogPostsPerDay}) + extra ({extraXPostsPerDay}) = {totalPerDay}
        </Badge>
      </div>

      {/* Live Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="p-3.5 rounded-xl bg-surface-muted/60 border border-border">
          <div className="text-foreground-muted">Blog-link X posts today ({telemetry.todayDate})</div>
          <div className="text-lg font-bold font-mono text-foreground mt-0.5">
            {telemetry.blogLinksDoneToday}
          </div>
        </div>
        <div className="p-3.5 rounded-xl bg-surface-muted/60 border border-border">
          <div className="text-foreground-muted">Extra X posts today (done / pending)</div>
          <div className="text-lg font-bold font-mono text-foreground mt-0.5">
            {telemetry.extrasDoneToday} / {telemetry.extrasPendingToday}
          </div>
        </div>
        <div className="p-3.5 rounded-xl bg-surface-muted/60 border border-border">
          <div className="text-foreground-muted">Month total vs cap ({telemetry.monthKey})</div>
          <div className="text-lg font-bold font-mono text-foreground mt-0.5">
            {telemetry.monthTotal} / {telemetry.monthlyXCap}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div>
          <label className="block text-xs font-medium text-foreground-muted mb-1.5">
            Extra X posts per day
          </label>
          <input
            type="number"
            min={0}
            max={20}
            value={extraXPostsPerDay}
            onChange={(e) => setExtraXPostsPerDay(Math.max(0, Number(e.target.value) || 0))}
            className="w-full px-3 py-2 rounded-lg bg-surface-muted border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground-muted mb-1.5">
            Monthly X cap
          </label>
          <input
            type="number"
            min={1}
            max={10000}
            value={monthlyXCap}
            onChange={(e) => setMonthlyXCap(Math.max(1, Number(e.target.value) || 300))}
            className="w-full px-3 py-2 rounded-lg bg-surface-muted border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground-muted mb-1.5">
            Window Start ({telemetry.timezone})
          </label>
          <input
            type="time"
            value={xWindowStart}
            onChange={(e) => setXWindowStart(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-surface-muted border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground-muted mb-1.5">
            Window End ({telemetry.timezone})
          </label>
          <input
            type="time"
            value={xWindowEnd}
            onChange={(e) => setXWindowEnd(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-surface-muted border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground-muted mb-1.5">
            No-repeat days
          </label>
          <input
            type="number"
            min={1}
            max={365}
            value={xNoRepeatDays}
            onChange={(e) => setXNoRepeatDays(Math.max(1, Number(e.target.value) || 14))}
            className="w-full px-3 py-2 rounded-lg bg-surface-muted border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      <p className="text-[11px] text-foreground-muted">
        Mid-day changes keep already-posted X slots untouched: lowering the number cancels excess pending slots for today; raising adds slots in the remaining window (or starting tomorrow if today&apos;s window closed). Tick precision is ~15 minutes.
      </p>

      {message && (
        <div
          className={`p-3 rounded-xl border text-xs ${
            message.type === "ok"
              ? "border-success/40 bg-surface-muted text-success"
              : "border-danger/40 bg-surface-muted text-danger"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          variant="primary"
          size="sm"
          isLoading={saving}
          disabled={saving}
          onClick={handleSave}
        >
          <Save className="w-3.5 h-3.5" />
          <span>Save Extra X Schedule</span>
        </Button>
      </div>
    </div>
  );
}

