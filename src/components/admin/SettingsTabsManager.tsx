"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Sliders,
  Share2,
  Bell,
  Cpu,
  Check,
  AlertTriangle,
  User,
  ExternalLink,
  BookOpen,
  Layers,
  UserCheck,
  Send,
  Globe,
  Image as ImageIcon,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { DisplaySettingsConfig } from "@/services/settings/display";
import type { NotificationSettingsConfig } from "@/services/notify/settings";
import { NotificationSettingsManager } from "@/components/admin/NotificationSettingsManager";
import { ShareButtons } from "@/components/blog/ShareButtons";
import { siteConfig } from "@/config/site";

interface SettingsTabsManagerProps {
  initialDisplaySettings: DisplaySettingsConfig;
  initialNotificationSettings: NotificationSettingsConfig;
}

type TabKey = "display" | "social" | "telegram" | "system";

interface TabMeta {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const TABS: TabMeta[] = [
  {
    key: "display",
    label: "Display & Attribution",
    icon: Sliders,
    description: "Public developer attribution, author profile, and research references.",
  },
  {
    key: "social",
    label: "Social & Sharing",
    icon: Share2,
    description: "Multi-platform share intents, custom channel toggles, and Telegram join link.",
  },
  {
    key: "telegram",
    label: "Telegram & Alerts",
    icon: Bell,
    description: "Notification sound modes, test alerts, and pipeline error channels.",
  },
  {
    key: "system",
    label: "System & Infrastructure",
    icon: Cpu,
    description: "Site identity, creator profile, and Cloudinary image CDN architecture.",
  },
];

export function SettingsTabsManager({
  initialDisplaySettings,
  initialNotificationSettings,
}: SettingsTabsManagerProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<TabKey>("display");
  const [displaySettings, setDisplaySettings] =
    useState<DisplaySettingsConfig>(initialDisplaySettings);
  const [savingDisplay, setSavingDisplay] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleToggle = (key: keyof DisplaySettingsConfig) => {
    setDisplaySettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleUrlChange = (val: string) => {
    setDisplaySettings((prev) => ({
      ...prev,
      telegramChannelUrl: val,
    }));
  };

  const handleSaveDisplay = async () => {
    setSavingDisplay(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/admin/settings/display", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(displaySettings),
      });

      if (!res.ok) {
        throw new Error("Failed to update display settings");
      }

      setStatusMsg({
        type: "success",
        text: "Configuration saved successfully.",
      });
    } catch (err) {
      setStatusMsg({
        type: "error",
        text: (err as Error).message,
      });
    } finally {
      setSavingDisplay(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation Pill Bar */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-surface border border-border">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setActiveTab(tab.key);
                setStatusMsg(null);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-foreground-muted hover:text-foreground hover:bg-surface-muted"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-primary-foreground" : "text-primary"}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Global Status Message */}
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

      {/* TAB 1: Display & Attribution */}
      {activeTab === "display" && (
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
              onClick={handleSaveDisplay}
              disabled={savingDisplay}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
            >
              {savingDisplay ? "Saving Changes..." : "Save Display Preferences"}
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
                  displaySettings.showDeveloperFooter ? "bg-primary" : "bg-border"
                }`}
                aria-label="Toggle developer profile in footer"
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow ring-0 transition duration-200 ease-in-out ${
                    displaySettings.showDeveloperFooter ? "translate-x-5" : "translate-x-0"
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
                  displaySettings.showDeveloperPostCard ? "bg-primary" : "bg-border"
                }`}
                aria-label="Toggle developer profile on blog post page"
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow ring-0 transition duration-200 ease-in-out ${
                    displaySettings.showDeveloperPostCard ? "translate-x-5" : "translate-x-0"
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
                  displaySettings.showDeveloperAboutPage ? "bg-primary" : "bg-border"
                }`}
                aria-label="Toggle developer profile on about page"
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow ring-0 transition duration-200 ease-in-out ${
                    displaySettings.showDeveloperAboutPage ? "translate-x-5" : "translate-x-0"
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
                  displaySettings.showPrimarySources ? "bg-primary" : "bg-border"
                }`}
                aria-label="Toggle primary research sources"
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow ring-0 transition duration-200 ease-in-out ${
                    displaySettings.showPrimarySources ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Editorial Author Attribution Toggle */}
            <div className="p-4 rounded-xl bg-surface-muted/50 border border-border flex items-start justify-between gap-4 md:col-span-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold text-foreground">
                    Editorial Author Attribution on Post Page
                  </span>
                </div>
                <p className="text-[11px] text-foreground-muted">
                  Displays the author attribution block in the header of individual blog posts.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleToggle("showEditorialAuthor")}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  displaySettings.showEditorialAuthor ? "bg-primary" : "bg-border"
                }`}
                aria-label="Toggle editorial author attribution"
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow ring-0 transition duration-200 ease-in-out ${
                    displaySettings.showEditorialAuthor ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Social & Sharing */}
      {activeTab === "social" && (
        <div className="space-y-6">
          {/* Live Preview Card */}
          <div className="p-6 rounded-2xl bg-surface border border-border space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">
                  Interactive Live Preview
                </h3>
              </div>
              <span className="text-[11px] font-mono text-foreground-muted px-2 py-0.5 rounded-md bg-surface-muted border border-border">
                Real-time Share Bar
              </span>
            </div>
            <div className="p-4 rounded-xl bg-surface-muted/40 border border-border/80 flex items-center justify-between">
              <span className="text-xs text-foreground-muted">
                Blog Article Share Bar:
              </span>
              <ShareButtons
                url="https://freshangle.blog/blog/next-gen-reasoning-models"
                title="Next-Gen AI Reasoning Systems: Benchmark Architecture Analysis"
                displaySettings={displaySettings}
              />
            </div>
          </div>

          {/* Social Settings Controls */}
          <div className="p-6 rounded-2xl bg-surface border border-border space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border">
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-primary" />
                  <span>Social Media & Share Bar Management</span>
                </h2>
                <p className="text-xs text-foreground-muted mt-1">
                  Configure share channels, quick copy buttons, and public Telegram community links.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveDisplay}
                disabled={savingDisplay}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
              >
                {savingDisplay ? "Saving Changes..." : "Save Social Preferences"}
              </button>
            </div>

            {/* Master Switch */}
            <div className="p-4 rounded-xl bg-surface-muted/60 border border-primary/20 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-xs font-bold text-foreground">
                  Master Switch: Blog Post Share Buttons
                </h3>
                <p className="text-[11px] text-foreground-muted mt-0.5">
                  Globally show or hide the entire share buttons bar on all blog articles.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleToggle("showShareButtons")}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  displaySettings.showShareButtons ? "bg-primary" : "bg-border"
                }`}
                aria-label="Toggle master share buttons"
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow ring-0 transition duration-200 ease-in-out ${
                    displaySettings.showShareButtons ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Telegram Channel Join Button & Invite Link */}
            <div className="p-4 rounded-xl bg-surface-muted/50 border border-border space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Send className="w-4 h-4 text-primary" />
                    <span className="text-xs font-bold text-foreground">
                      Public Telegram Community Join Button
                    </span>
                  </div>
                  <p className="text-[11px] text-foreground-muted">
                    Displays a &quot;Join Telegram Channel&quot; pill in the header, mobile navigation drawer, and footer banner.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle("showTelegramJoin")}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    displaySettings.showTelegramJoin ? "bg-primary" : "bg-border"
                  }`}
                  aria-label="Toggle Telegram join button"
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow ring-0 transition duration-200 ease-in-out ${
                      displaySettings.showTelegramJoin ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {displaySettings.showTelegramJoin && (
                <div className="pt-2 border-t border-border/60">
                  <label className="block text-[11px] font-medium text-foreground-muted mb-1">
                    Telegram Channel Invite Link
                  </label>
                  <input
                    type="url"
                    placeholder="https://t.me/freshangle_blog"
                    value={displaySettings.telegramChannelUrl || ""}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-foreground font-mono text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              )}
            </div>

            {/* Individual Channels Grid */}
            <div>
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">
                Individual Share Channels
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { key: "shareX" as const, name: "𝕏 (Twitter)", desc: "Direct tweet intent" },
                  { key: "shareLinkedIn" as const, name: "LinkedIn", desc: "Professional network" },
                  { key: "shareTelegram" as const, name: "Telegram", desc: "Channel / chat share" },
                  { key: "shareWhatsApp" as const, name: "WhatsApp", desc: "Direct messaging" },
                  { key: "shareReddit" as const, name: "Reddit", desc: "Community discussion" },
                  { key: "shareHackerNews" as const, name: "Hacker News", desc: "Tech discussions" },
                  { key: "shareFacebook" as const, name: "Facebook", desc: "Feed sharing" },
                  { key: "shareCopyLink" as const, name: "Copy Link", desc: "Instant clipboard copy" },
                ].map((channel) => (
                  <div
                    key={channel.key}
                    className="p-3 rounded-xl bg-surface-muted/40 border border-border flex items-center justify-between gap-2"
                  >
                    <div>
                      <p className="text-xs font-bold text-foreground">
                        {channel.name}
                      </p>
                      <p className="text-[10px] text-foreground-muted">
                        {channel.desc}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggle(channel.key)}
                      disabled={!displaySettings.showShareButtons}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-40 ${
                        displaySettings[channel.key] ? "bg-primary" : "bg-border"
                      }`}
                      aria-label={`Toggle ${channel.name}`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-surface shadow ring-0 transition duration-200 ease-in-out ${
                          displaySettings[channel.key] ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Telegram & Alerts */}
      {activeTab === "telegram" && (
        <NotificationSettingsManager initialSettings={initialNotificationSettings} />
      )}

      {/* TAB 4: System & Infrastructure */}
      {activeTab === "system" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Creator Attribution */}
          <div className="p-6 rounded-2xl bg-surface border border-border space-y-4">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              <span>Creator Profile Attribution</span>
            </h2>
            {siteConfig.creator ? (
              <div className="flex items-center gap-4 p-4 rounded-xl bg-surface-muted border border-border">
                <div
                  className="relative w-16 h-16 rounded-xl overflow-hidden border border-border shrink-0"
                  style={{ width: "64px", height: "64px" }}
                >
                  <Image
                    src={siteConfig.creator.image}
                    alt={siteConfig.creator.name}
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className="font-bold text-foreground">
                    {siteConfig.creator.name}
                  </p>
                  <a
                    href={siteConfig.creator.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    {siteConfig.creator.url}
                  </a>
                  <p className="text-[11px] text-foreground-muted mt-0.5">
                    Asset: {siteConfig.creator.image}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-surface-muted border border-border text-xs text-foreground-muted">
                No creator profile configured. Provide <code>CREATOR_NAME</code>, <code>CREATOR_URL</code>, and <code>CREATOR_IMAGE</code> in environment variables.
              </div>
            )}
            <p className="text-xs text-foreground-muted leading-relaxed">
              Standardized across portfolio publications. Configured via environment variables.
            </p>
          </div>

          {/* Site Properties */}
          <div className="p-6 rounded-2xl bg-surface border border-border space-y-4">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" />
              <span>Site & Deployment Identity</span>
            </h2>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-muted">
                <span className="text-foreground-muted">Site Name</span>
                <strong className="text-foreground">{siteConfig.name}</strong>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-muted">
                <span className="text-foreground-muted">Canonical Domain</span>
                <strong className="font-mono text-primary">
                  {siteConfig.url}
                </strong>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-muted">
                <span className="text-foreground-muted">Default Timezone</span>
                <strong className="text-foreground">{siteConfig.timezone}</strong>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-muted">
                <span className="text-foreground-muted">Content Language</span>
                <strong className="text-foreground">{siteConfig.language}</strong>
              </div>
            </div>
          </div>

          {/* Image Storage & CDN Architecture */}
          <div className="p-6 rounded-2xl bg-surface border border-border space-y-4 md:col-span-2">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-primary" />
              <span>Image Storage & CDN Architecture</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-surface-muted border border-border space-y-1">
                <span className="text-foreground-muted block font-medium">Storage Provider</span>
                <div className="flex items-center gap-1.5 text-foreground font-semibold">
                  <ShieldCheck className="w-4 h-4 text-success" />
                  <span>Cloudinary CDN</span>
                </div>
                <p className="text-[11px] text-foreground-muted">
                  Signed WebP uploads, responsive transforms, and edge CDN delivery.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-muted border border-border space-y-1">
                <span className="text-foreground-muted block font-medium">Target Asset Folder</span>
                <div className="font-mono text-primary font-semibold">
                  {process.env.CLOUDINARY_FOLDER || "fresh-angle/covers"}
                </div>
                <p className="text-[11px] text-foreground-muted">
                  Deterministic keys: <code>{"{folder}/{yyyy}/{mm}/{slug}-{hash}"}</code>.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-muted border border-border space-y-1">
                <span className="text-foreground-muted block font-medium">Image Generation Pipeline</span>
                <div className="font-mono text-foreground font-semibold">
                  Cloudflare Flux &rarr; Pollinations &rarr; Imagen 3
                </div>
                <p className="text-[11px] text-foreground-muted">
                  Resilient multi-model fallback chain with unconstrained creative art direction.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
