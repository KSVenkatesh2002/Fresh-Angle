"use client";

import React, { useState } from "react";
import { formatDualTime } from "@/lib/utils/time";
import { PostSlot, TopicQueue, Category } from "@/db/schema";
import { Calendar, Plus, ListPlus, Trash2, CheckCircle2, RotateCcw } from "lucide-react";

interface ScheduleQueueManagerProps {
  slots: PostSlot[];
  queue: TopicQueue[];
  categories: Category[];
}

export function ScheduleQueueManager({
  slots,
  queue,
  categories,
}: ScheduleQueueManagerProps): React.JSX.Element {
  const [bulkText, setBulkText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [importing, setImporting] = useState(false);
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleBulkImport(): Promise<void> {
    const titles = bulkText
      .split("\n")
      .map((t) => t.trim())
      .filter((t) => t.length > 3);

    if (titles.length === 0) return;
    setImporting(true);
    setMsg(null);

    try {
      const res = await fetch("/api/admin/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bulk_import",
          titles,
          categoryId: selectedCategory || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to import topics");
      setBulkText("");
      setMsg(
        `Successfully queued ${titles.length} research topics! Refresh to see new list.`,
      );
    } catch (err) {
      setMsg(`Error: ${(err as Error).message}`);
    } finally {
      setImporting(false);
    }
  }

  async function handleCancelQueueItem(id: string): Promise<void> {
    try {
      await fetch("/api/admin/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", id }),
      });
      setMsg("Topic removed from queue. Refresh to update list.");
    } catch {
      // silent
    }
  }

  async function handleRescheduleSlot(slotId: string): Promise<void> {
    setReschedulingId(slotId);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/schedule/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reschedule slot");
      setMsg("Slot successfully rescheduled for immediate execution! Refresh to see updated list.");
    } catch (err) {
      setMsg(`Reschedule Error: ${(err as Error).message}`);
    } finally {
      setReschedulingId(null);
    }
  }

  return (
    <div className="space-y-8">
      {msg && (
        <div className="p-3.5 rounded-xl bg-surface border border-primary/40 text-primary text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{msg}</span>
        </div>
      )}

      {/* Bulk Queue Import Box */}
      <div className="p-6 rounded-2xl bg-surface border border-border space-y-4">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <ListPlus className="w-4 h-4 text-primary" />
          <span>Bulk Queue Import</span>
        </h2>
        <p className="text-xs text-foreground-muted">
          Paste multiple article headlines or research prompts (one per line) to
          schedule them into the publication queue.
        </p>

        <textarea
          rows={4}
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          placeholder={`GPT-5 Architecture Rumors and Compute Scaling\nNVIDIA Rubin GPU Architecture Deep Dive\nMamba vs Transformers Benchmarks 2026`}
          className="w-full px-3.5 py-2.5 rounded-xl bg-surface-muted border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-surface-muted border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">Auto-Assign Track</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleBulkImport}
            disabled={importing || !bulkText.trim()}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{importing ? "Importing..." : "Add Topics to Queue"}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Topic Queue */}
        <div className="p-6 rounded-2xl bg-surface border border-border space-y-4">
          <h2 className="text-base font-bold text-foreground flex items-center justify-between">
            <span>Active Topic Queue</span>
            <span className="text-xs px-2 py-0.5 rounded bg-surface-muted border border-border text-foreground-muted">
              {queue.length} items
            </span>
          </h2>

          {queue.length === 0 ? (
            <p className="text-xs text-foreground-muted">
              No topics currently in queue.
            </p>
          ) : (
            <ul className="space-y-2">
              {queue.map((item) => (
                <li
                  key={item.id}
                  className="p-3 rounded-xl bg-surface-muted border border-border flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">
                      {item.title}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-foreground-muted">
                      <span className="uppercase font-mono px-1 rounded bg-surface border border-border">
                        {item.status}
                      </span>
                      <span>Priority: {item.priority}</span>
                    </div>
                  </div>
                  {item.status === "queued" && (
                    <button
                      type="button"
                      onClick={() => handleCancelQueueItem(item.id)}
                      className="text-foreground-muted hover:text-danger transition-colors p-1"
                      aria-label="Cancel topic"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Planned Post Slots */}
        <div className="p-6 rounded-2xl bg-surface border border-border space-y-4">
          <h2 className="text-base font-bold text-foreground flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              <span>Upcoming Publishing Slots</span>
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-surface-muted border border-border text-foreground-muted">
              {slots.length} slots
            </span>
          </h2>

          {slots.length === 0 ? (
            <p className="text-xs text-foreground-muted">
              No active slots planned.
            </p>
          ) : (
            <ul className="space-y-2">
              {slots.map((slot) => {
                const date = new Date(slot.plannedAt);
                return (
                  <li
                    key={slot.id}
                    className="p-3 rounded-xl bg-surface-muted border border-border flex items-center justify-between text-xs"
                  >
                    <div className="space-y-0.5 max-w-[65%]">
                      <p className="font-medium text-foreground">
                        {date.toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          timeZone: "UTC",
                        })}{" "}
                        · {formatDualTime(date)}
                      </p>
                      <div className="flex items-center gap-2">
                        {slot.origin === "test" ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-warning/15 border border-warning/30 text-warning">
                            🧪 TEST
                          </span>
                        ) : (
                          <span className="text-[10px] text-foreground-muted capitalize">
                            Origin: {slot.origin}
                          </span>
                        )}
                        {slot.attempts > 0 && (
                          <span className="text-[10px] text-foreground-muted">
                            Attempts: {slot.attempts}
                          </span>
                        )}
                      </div>
                      {slot.error && (
                        <p className="text-[10px] text-danger/90 truncate" title={slot.error}>
                          Reason: {slot.error}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {(slot.status === "missed" || slot.status === "failed") && (
                        <button
                          type="button"
                          onClick={() => handleRescheduleSlot(slot.id)}
                          disabled={reschedulingId === slot.id}
                          className="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-[10px] font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
                          title="Reschedule this slot for immediate execution"
                        >
                          <RotateCcw className={`w-3 h-3 ${reschedulingId === slot.id ? "animate-spin" : ""}`} />
                          <span>{reschedulingId === slot.id ? "Rescheduling..." : "Reschedule"}</span>
                        </button>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono capitalize border ${
                          slot.status === "done"
                            ? "bg-success/15 border-success/30 text-success"
                            : slot.status === "running"
                              ? "bg-primary/15 border-primary/30 text-primary"
                              : slot.status === "failed" ||
                                  slot.status === "missed"
                                ? "bg-danger/15 border-danger/30 text-danger"
                                : "bg-surface border-border text-foreground-muted"
                        }`}
                      >
                        {slot.status}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
