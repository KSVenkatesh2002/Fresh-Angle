"use client";

import React, { useState } from "react";
import { DisplaySettingsConfig } from "@/services/settings/display";
import { Sliders, Check, AlertTriangle, User, ExternalLink, BookOpen, Layers } from "lucide-react";

interface DisplaySettingsManagerProps {
  initialSettings: DisplaySettingsConfig;
}

export function DisplaySettingsManager({
  initialSettings,
}: DisplaySettingsManagerProps): React.JSX.Element {
  const [settings, setSettings] = useState<DisplaySettingsConfig>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleToggle = (key: keyof DisplaySettingsConfig) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/admin/settings/display", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (!res.ok) {
        throw new Error("Failed to update display settings");
      }

      setStatusMsg({
        type: "success",
        text: "Display preferences updated successfully.",
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
              <Sliders className="w-4 h-4 text-primary" />
              <span>Public Content & Attribution Display Toggles</span>
            </h2>
            <p className="text-xs text-foreground-muted mt-1">
              Control the visibility of developer / creator attribution profiles and research sources across public views.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? "Saving Changes..." : "Save Display Preferences"}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Footer Profile Toggle */}
          <div className="p-4 rounded-xl bg-surface-muted/50 border border-border flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-foreground">
                  Developer Profile in Site Footer
                </span>
              </div>
              <p className="text-[11px] text-foreground-muted">
                Displays the creator photo, bio, and portfolio link in the global site footer.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleToggle("showDeveloperFooter")}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                settings.showDeveloperFooter ? "bg-primary" : "bg-border"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow ring-0 transition duration-200 ease-in-out ${
                  settings.showDeveloperFooter ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Blog Post Profile Toggle */}
          <div className="p-4 rounded-xl bg-surface-muted/50 border border-border flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-foreground">
                  Developer Profile on Blog Post Page
                </span>
              </div>
              <p className="text-[11px] text-foreground-muted">
                Displays the &quot;Created by&quot; developer profile box at the bottom of individual blog articles.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleToggle("showDeveloperPostCard")}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                settings.showDeveloperPostCard ? "bg-primary" : "bg-border"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow ring-0 transition duration-200 ease-in-out ${
                  settings.showDeveloperPostCard ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* About Page Profile Toggle */}
          <div className="p-4 rounded-xl bg-surface-muted/50 border border-border flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-foreground">
                  Developer Profile on About Page
                </span>
              </div>
              <p className="text-[11px] text-foreground-muted">
                Displays the leadership biography card on the public &quot;/about&quot; page.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleToggle("showDeveloperAboutPage")}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                settings.showDeveloperAboutPage ? "bg-primary" : "bg-border"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow ring-0 transition duration-200 ease-in-out ${
                  settings.showDeveloperAboutPage ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Primary Research Sources Toggle */}
          <div className="p-4 rounded-xl bg-surface-muted/50 border border-border flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-foreground">
                  Primary Research Sources & Dispatches
                </span>
              </div>
              <p className="text-[11px] text-foreground-muted">
                Displays the &quot;Primary Research Sources &amp; Dispatches&quot; reference list at the bottom of blog articles.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleToggle("showPrimarySources")}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                settings.showPrimarySources ? "bg-primary" : "bg-border"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow ring-0 transition duration-200 ease-in-out ${
                  settings.showPrimarySources ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
