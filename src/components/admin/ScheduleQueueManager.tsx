"use client";

import React, { useState, useMemo } from "react";
import { formatDualTime } from "@/lib/utils/time";
import { PostSlot, TopicQueue, Category } from "@/db/schema";
import {
  Calendar,
  Plus,
  ListPlus,
  Trash2,
  CheckCircle2,
  RotateCcw,
  CheckSquare,
  Square,
  Layers,
} from "lucide-react";

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
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [bulkActionRunning, setBulkActionRunning] = useState(false);

  // Group slots by date (YYYY-MM-DD UTC)
  const groupedSlots = useMemo(() => {
    const map = new Map<string, PostSlot[]>();
    for (const slot of slots) {
      const d = new Date(slot.plannedAt);
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(d.getUTCDate()).padStart(2, "0");
      const dateKey = `${yyyy}-${mm}-${dd}`;
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(slot);
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [slots]);

  function toggleSlotSelection(id: string): void {
    setSelectedSlots((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function toggleSelectAll(): void {
    if (selectedSlots.length === slots.length) {
      setSelectedSlots([]);
    } else {
      setSelectedSlots(slots.map((s) => s.id));
    }
  }

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

  async function handleBulkReschedule(): Promise<void> {
    if (selectedSlots.length === 0) return;
    setBulkActionRunning(true);
    setMsg(null);
    let successCount = 0;

    for (const slotId of selectedSlots) {
      try {
        const res = await fetch("/api/admin/schedule/reschedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slotId }),
        });
        if (res.ok) successCount++;
      } catch {
        // continue
      }
    }

    setBulkActionRunning(false);
    setSelectedSlots([]);
    setMsg(`Bulk rescheduled ${successCount} slot(s) for immediate execution! Refresh to see updated list.`);
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
          <span>Bulk Import Topic Queue</span>
        </h2>
        <p className="text-xs text-foreground-muted">
          Add prioritized research themes (one per line). The autonomous pipeline picks from this queue first before fetching trending topics.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-3">
            <textarea
              rows={3}
              placeholder="DeepSeek V3 Architectural Breakdown&#10;Nvidia Blackwell Ultra NVL72 Benchmark&#10;Autonomous Coding Agent Patterns"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-surface-muted border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring font-mono"
            />
          </div>

          <div className="space-y-2 flex flex-col justify-between">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-surface-muted border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Auto-Detect Category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.code ? `[${cat.code}] ` : ""}{cat.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleBulkImport}
              disabled={importing || !bulkText.trim()}
              className="w-full px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>{importing ? "Importing..." : "Add to Queue"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Active Queue & Post Slots */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Topic Queue */}
        <div className="p-6 rounded-2xl bg-surface border border-border space-y-4">
          <h2 className="text-base font-bold text-foreground flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <span>Priority Topic Queue</span>
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-surface-muted border border-border text-foreground-muted">
              {queue.length} items
            </span>
          </h2>

          {queue.length === 0 ? (
            <p className="text-xs text-foreground-muted">
              Queue is currently empty. Next slot will pick from trending research feeds.
            </p>
          ) : (
            <ul className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {queue.map((item) => (
                <li
                  key={item.id}
                  className="p-3 rounded-xl bg-surface-muted border border-border flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">{item.title}</p>
                    <div className="flex items-center gap-2 text-[10px] text-foreground-muted">
                      <span className="px-1.5 py-0.5 rounded bg-surface border border-border font-mono">
                        Priority: {item.priority}
                      </span>
                      <span className="capitalize">{item.status}</span>
                    </div>
                  </div>
                  {item.status === "queued" && (
                    <button
                      type="button"
                      onClick={() => handleCancelQueueItem(item.id)}
                      className="p-1 rounded-lg text-foreground-muted hover:text-danger hover:bg-danger/10 transition-colors"
                      title="Remove from queue"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Planned Post Slots Grouped by Date */}
        <div className="p-6 rounded-2xl bg-surface border border-border space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              <span>Publishing Slots</span>
            </h2>

            {/* Bulk Selection Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-xs text-foreground-muted hover:text-foreground flex items-center gap-1"
              >
                {selectedSlots.length === slots.length && slots.length > 0 ? (
                  <CheckSquare className="w-3.5 h-3.5 text-primary" />
                ) : (
                  <Square className="w-3.5 h-3.5" />
                )}
                <span>Select All</span>
              </button>

              {selectedSlots.length > 0 && (
                <button
                  type="button"
                  onClick={handleBulkReschedule}
                  disabled={bulkActionRunning}
                  className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground font-semibold text-[10px] flex items-center gap-1 hover:opacity-90 disabled:opacity-50"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reschedule ({selectedSlots.length})</span>
                </button>
              )}
            </div>
          </div>

          {slots.length === 0 ? (
            <p className="text-xs text-foreground-muted">
              No active slots planned.
            </p>
          ) : (
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
              {groupedSlots.map(([dateKey, daySlots]) => (
                <div key={dateKey} className="space-y-2">
                  <div className="flex items-center justify-between border-b border-border pb-1">
                    <span className="text-[11px] font-bold text-foreground uppercase tracking-wider font-mono">
                      📅 {dateKey}
                    </span>
                    <span className="text-[10px] text-foreground-muted">
                      {daySlots.length} slot(s)
                    </span>
                  </div>

                  <ul className="space-y-2">
                    {daySlots.map((slot) => {
                      const date = new Date(slot.plannedAt);
                      const isSelected = selectedSlots.includes(slot.id);
                      return (
                        <li
                          key={slot.id}
                          className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                            isSelected
                              ? "bg-primary/5 border-primary/40"
                              : "bg-surface-muted border-border"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 max-w-[70%]">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSlotSelection(slot.id)}
                              className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer"
                            />

                            <div className="space-y-0.5">
                              <p className="font-medium text-foreground">
                                {formatDualTime(date)}
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
                                {slot.slotCode && (
                                  <span className="text-[10px] font-mono px-1 py-0.5 rounded bg-surface border border-border text-foreground-muted">
                                    Code: {slot.slotCode}
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
                          </div>

                          <div className="flex items-center gap-2">
                            {(slot.status === "missed" || slot.status === "failed") && (
                              <button
                                type="button"
                                onClick={() => handleRescheduleSlot(slot.id)}
                                disabled={reschedulingId === slot.id}
                                className="px-2 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-[10px] font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
                                title="Reschedule this slot for immediate execution"
                              >
                                <RotateCcw className={`w-3 h-3 ${reschedulingId === slot.id ? "animate-spin" : ""}`} />
                                <span>{reschedulingId === slot.id ? "..." : "Reschedule"}</span>
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
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
