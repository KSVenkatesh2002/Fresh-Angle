"use client";

import React, { useState } from "react";
import {
  NotificationSettingsConfig,
  NotificationChannelMode,
} from "@/services/notify/settings";
import { Bell, BellOff, Volume2, VolumeX, Check, AlertTriangle, Users } from "lucide-react";

interface NotificationSettingsManagerProps {
  initialSettings: NotificationSettingsConfig;
}

interface NotificationChannelMeta {
  key: keyof NotificationSettingsConfig;
  title: string;
  description: string;
  category: "publishing" | "system" | "visitors";
}

const CHANNELS: NotificationChannelMeta[] = [
  {
    key: "postPublished",
    title: "Post Published Successfully",
    description: "Fires when an article completes all steps and is published live on the website.",
    category: "publishing",
  },
  {
    key: "postDraftTest",
    title: "Draft / Dry-Run Test Posts",
    description: "Fires when test slots or dry-run drafts are created without public publishing.",
    category: "publishing",
  },
  {
    key: "pipelineFailure",
    title: "Pipeline Execution Failures",
    description: "Immediate alert when AI generation, research, or image upload encounters an error.",
    category: "system",
  },
  {
    key: "schedulerDisruption",
    title: "Scheduler & Cloudflare Disruption",
    description: "Triggered if no tick runs for 90+ minutes during the active posting window.",
    category: "system",
  },
  {
    key: "quotaUsageAlerts",
    title: "Provider Quota & Daily Limit Warnings",
    description: "Fires at 80% soft quota warning and 100% hard limit cutoff for AI providers.",
    category: "system",
  },
  {
    key: "dbStorageAlerts",
    title: "Neon DB Disk Capacity Thresholds",
    description: "Alerts when Neon database disk storage reaches 70% or 90% footprint.",
    category: "system",
  },
  {
    key: "contactFormAlerts",
    title: "Contact Form Submissions",
    description: "Instant dispatch when a visitor transmits a message on the public contact page.",
    category: "visitors",
  },
];

export function NotificationSettingsManager({
  initialSettings,
}: NotificationSettingsManagerProps): React.JSX.Element {
  const [settings, setSettings] = useState<NotificationSettingsConfig>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleModeChange = (
    key: keyof NotificationSettingsConfig,
    mode: NotificationChannelMode,
  ) => {
    setSettings((prev) => ({
      ...prev,
      [key]: mode,
    }));
  };

  const handleTogglePublicBroadcast = () => {
    setSettings((prev) => ({
      ...prev,
      publicChannelBroadcast: !prev.publicChannelBroadcast,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (!res.ok) {
        throw new Error("Failed to update notification settings");
      }

      setStatusMsg({
        type: "success",
        text: "Telegram notification preferences saved successfully.",
      });
    } catch (err) {
      setStatusMsg({
        type: "error",
        text: (err as Error).message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {statusMsg && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center gap-2 ${
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

      <div className="p-6 rounded-2xl bg-surface border border-border space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              <span>Telegram Notification Routing & Sound Controls</span>
            </h2>
            <p className="text-xs text-foreground-muted mt-1">
              Choose whether each alert type rings audibly (Loud), delivers silently without vibration (Silent), or is muted completely.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? "Saving Preferences..." : "Save Notification Preferences"}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {CHANNELS.map((ch) => {
            const currentMode = settings[ch.key];
            return (
              <div
                key={ch.key}
                className="p-4 rounded-xl bg-surface-muted/50 border border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground">
                      {ch.title}
                    </span>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-surface border border-border text-foreground-muted">
                      {ch.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-foreground-muted">
                    {ch.description}
                  </p>
                </div>

                {/* Mode Selector Pill Buttons */}
                <div className="inline-flex rounded-lg border border-border bg-surface p-1 self-start sm:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => handleModeChange(ch.key, "loud")}
                    className={`px-3 py-1.5 rounded-md text-[11px] font-semibold flex items-center gap-1.5 transition-colors ${
                      currentMode === "loud"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-foreground-muted hover:text-foreground"
                    }`}
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Loud (Sound)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleModeChange(ch.key, "silent")}
                    className={`px-3 py-1.5 rounded-md text-[11px] font-semibold flex items-center gap-1.5 transition-colors ${
                      currentMode === "silent"
                        ? "bg-primary/20 text-primary border border-primary/40 font-bold"
                        : "text-foreground-muted hover:text-foreground"
                    }`}
                  >
                    <VolumeX className="w-3.5 h-3.5" />
                    <span>Silent (No Ring)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleModeChange(ch.key, "disabled")}
                    className={`px-3 py-1.5 rounded-md text-[11px] font-semibold flex items-center gap-1.5 transition-colors ${
                      currentMode === "disabled"
                        ? "bg-danger/20 text-danger border border-danger/40 font-bold"
                        : "text-foreground-muted hover:text-foreground"
                    }`}
                  >
                    <BellOff className="w-3.5 h-3.5" />
                    <span>Disabled</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Public Telegram Channel Broadcast for All Users (Post Published Only) */}
        <div className="pt-6 border-t border-border space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-surface-muted/60 border border-border">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <span className="text-sm font-bold text-foreground">
                  Public Telegram Channel Broadcast (All Users / Readers)
                </span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary font-bold">
                  Post Published Only
                </span>
              </div>
              <p className="text-xs text-foreground-muted max-w-xl">
                Automatically broadcasts every newly published dispatch to your public Telegram channel or group so all readers and community members receive real-time publication alerts.
              </p>
            </div>

            <button
              type="button"
              onClick={handleTogglePublicBroadcast}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                settings.publicChannelBroadcast ? "bg-primary" : "bg-border"
              }`}
              title={settings.publicChannelBroadcast ? "Disable Public Broadcast" : "Enable Public Broadcast"}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow ring-0 transition duration-200 ease-in-out ${
                  settings.publicChannelBroadcast ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {settings.publicChannelBroadcast && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-surface border border-border text-xs">
              <div>
                <label className="block text-foreground-muted font-medium mb-1">
                  Public Channel Chat ID / Username
                </label>
                <input
                  type="text"
                  placeholder="@your_channel or -100xxxxxxxxxx"
                  value={settings.publicChannelId || ""}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      publicChannelId: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-surface-muted border border-border text-foreground font-mono text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <p className="text-[11px] text-foreground-muted mt-1">
                  Make sure your bot is added as an <strong>Administrator</strong> with post messages permission.
                </p>
              </div>

              <div>
                <label className="block text-foreground-muted font-medium mb-1">
                  Public Channel Link (Optional for footer/site link)
                </label>
                <input
                  type="text"
                  placeholder="https://t.me/your_channel"
                  value={settings.publicChannelUrl || ""}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      publicChannelUrl: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-surface-muted border border-border text-foreground font-mono text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <p className="text-[11px] text-foreground-muted mt-1">
                  Public invitation link for readers to join your Telegram channel.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
