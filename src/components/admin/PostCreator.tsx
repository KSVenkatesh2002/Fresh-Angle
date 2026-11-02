"use client";

import React, { useState, useEffect } from "react";
import { Category } from "@/db/schema";
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Save,
  Send,
} from "lucide-react";

interface PostCreatorProps {
  categories: Category[];
}

export function PostCreator({
  categories,
}: PostCreatorProps): React.JSX.Element {
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tone, setTone] = useState("authoritative");
  const [length, setLength] = useState<"short" | "medium" | "long">("medium");
  const [coverMode, setCoverMode] = useState<
    "ai" | "pexels" | "default" | "none"
  >("ai");
  const [action, setAction] = useState<
    "generate_now" | "save_draft" | "schedule_publish" | "schedule_generate"
  >("generate_now");
  const [scheduledAt, setScheduledAt] = useState("");

  // Duplicate warning state
  const [duplicateWarning, setDuplicateWarning] = useState<{
    isDuplicate: boolean;
    reason?: string;
  } | null>(null);
  const [overrideDuplicate, setOverrideDuplicate] = useState(false);
  const [checkingDup, setCheckingDup] = useState(false);

  const [loading, setLoading] = useState(false);
  const [resultMsg, setResultMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Debounced duplicate check
  useEffect(() => {
    if (!title || title.trim().length < 8) {
      setDuplicateWarning(null);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingDup(true);
      try {
        const res = await fetch("/api/admin/posts/check-duplicate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim() }),
        });
        const data = await res.json();
        if (data.isDuplicate) {
          setDuplicateWarning({ isDuplicate: true, reason: data.reason });
        } else {
          setDuplicateWarning(null);
        }
      } catch {
        // silent
      } finally {
        setCheckingDup(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [title]);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (duplicateWarning?.isDuplicate && !overrideDuplicate) {
      setResultMsg({
        type: "error",
        text: "Please resolve or override the duplicate warning before submitting",
      });
      return;
    }

    setLoading(true);
    setResultMsg(null);

    try {
      const res = await fetch("/api/admin/posts/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          prompt,
          categoryId: categoryId || undefined,
          tone,
          length,
          coverMode,
          action,
          scheduledAt: scheduledAt
            ? new Date(scheduledAt).toISOString()
            : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process post");

      setResultMsg({
        type: "success",
        text: data.message || "Operation completed successfully!",
      });
      if (action !== "generate_now") {
        setTitle("");
        setPrompt("");
      }
    } catch (err) {
      setResultMsg({ type: "error", text: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {resultMsg && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-center gap-2 ${
            resultMsg.type === "success"
              ? "bg-surface border-success/40 text-success"
              : "bg-surface border-danger/40 text-danger"
          }`}
        >
          {resultMsg.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{resultMsg.text}</span>
        </div>
      )}

      {/* Duplicate Warning Alert */}
      {duplicateWarning?.isDuplicate && (
        <div className="p-4 rounded-xl bg-surface border border-warning/40 text-warning text-xs space-y-2">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Potential Duplicate Detected</span>
          </div>
          <p className="leading-relaxed">
            {duplicateWarning.reason ||
              "A highly similar article already exists in the system."}
          </p>
          <label className="flex items-center gap-2 text-foreground font-medium pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={overrideDuplicate}
              onChange={(e) => setOverrideDuplicate(e.target.checked)}
              className="rounded accent-primary"
            />
            <span>
              I understand, override duplicate check and proceed anyway
            </span>
          </label>
        </div>
      )}

      <div className="p-6 rounded-2xl bg-surface border border-border space-y-5">
        <div>
          <label
            htmlFor="post-title"
            className="block text-xs font-semibold uppercase tracking-wider text-foreground mb-1.5"
          >
            Post Title / Headline
          </label>
          <input
            id="post-title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Anthropic Introduces Claude 3.7 Sonnet with Hybrid Reasoning"
            className="w-full px-4 py-2.5 rounded-xl bg-surface-muted border border-border text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {checkingDup && (
            <p className="text-[11px] text-foreground-muted mt-1">
              Analyzing duplicate index...
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="post-prompt"
            className="block text-xs font-semibold uppercase tracking-wider text-foreground mb-1.5"
          >
            Specific Angle / Guiding Research Prompt (Optional)
          </label>
          <textarea
            id="post-prompt"
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Focus on benchmark comparisons vs DeepSeek R1, architectural trade-offs, and inference costs..."
            className="w-full px-4 py-2.5 rounded-xl bg-surface-muted border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-foreground-muted mb-1.5">
              Track / Category
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface-muted border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Auto-Assign Track</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground-muted mb-1.5">
              Editorial Tone
            </label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface-muted border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="authoritative">Authoritative & Technical</option>
              <option value="analytical">Deep Analytical</option>
              <option value="conversational">Engaging & Direct</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground-muted mb-1.5">
              Target Depth / Length
            </label>
            <select
              value={length}
              onChange={(e) =>
                setLength(e.target.value as "short" | "medium" | "long")
              }
              className="w-full px-3 py-2 rounded-lg bg-surface-muted border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="short">Short Briefing (~800 words)</option>
              <option value="medium">Standard Synthesis (~1200 words)</option>
              <option value="long">Deep Whitepaper (~1800 words)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground-muted mb-1.5">
              Cover Art Engine
            </label>
            <select
              value={coverMode}
              onChange={(e) =>
                setCoverMode(
                  e.target.value as "ai" | "pexels" | "default" | "none",
                )
              }
              className="w-full px-3 py-2 rounded-lg bg-surface-muted border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="ai">Cloudflare Workers AI</option>
              <option value="pexels">Pexels Curated Photography</option>
              <option value="default">Default Branded Cover</option>
            </select>
          </div>
        </div>

        {/* Action Strategy */}
        <div className="pt-4 border-t border-border space-y-4">
          <label className="block text-xs font-semibold uppercase tracking-wider text-foreground">
            Publishing Action
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                id: "generate_now",
                title: "Generate & Publish Now",
                icon: Sparkles,
              },
              { id: "save_draft", title: "Save as Manual Draft", icon: Save },
              {
                id: "schedule_publish",
                title: "Schedule Publication Time",
                icon: Clock,
              },
              {
                id: "schedule_generate",
                title: "Schedule Future Generation",
                icon: Send,
              },
            ].map((opt) => {
              const Icon = opt.icon;
              const isSelected = action === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setAction(opt.id as typeof action)}
                  className={`p-3.5 rounded-xl border text-left flex flex-col gap-2 transition-all ${
                    isSelected
                      ? "border-primary bg-primary/10 text-primary font-semibold"
                      : "border-border bg-surface-muted text-foreground-muted hover:border-primary/50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-xs leading-tight">{opt.title}</span>
                </button>
              );
            })}
          </div>

          {(action === "schedule_publish" ||
            action === "schedule_generate") && (
            <div className="p-4 rounded-xl bg-surface-muted border border-border max-w-sm space-y-1.5">
              <label className="block text-xs font-medium text-foreground">
                Target Date & Time (UTC)
              </label>
              <input
                type="datetime-local"
                required
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-border flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2 shadow-sm"
          >
            <Sparkles className="w-4 h-4" />
            <span>{loading ? "Executing pipeline..." : "Execute Action"}</span>
          </button>
        </div>
      </div>
    </form>
  );
}
