import React from "react";
import type { Metadata } from "next";
import { getNotificationSettings } from "@/services/notify/settings";
import { getDisplaySettings } from "@/services/settings/display";
import { SettingsTabsManager } from "@/components/admin/SettingsTabsManager";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "System Settings & Architecture Profiles",
  robots: { index: false, follow: false },
};

export default async function AdminSettingsPage(): Promise<React.JSX.Element> {
  const [notificationSettings, displaySettings] = await Promise.all([
    getNotificationSettings(),
    getDisplaySettings(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
          System & Platform Settings
        </h1>
        <p className="text-sm text-foreground-muted">
          Configure display toggles, social sharing channels, Telegram notifications, and system infrastructure.
        </p>
      </div>

      <SettingsTabsManager
        initialDisplaySettings={displaySettings}
        initialNotificationSettings={notificationSettings}
      />
    </div>
  );
}
