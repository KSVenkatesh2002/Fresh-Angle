import React from "react";
import type { Metadata } from "next";
import { getDb } from "@/db/client";
import { automationSettings } from "@/db/schema";
import { calculateDaySlotTimes } from "@/services/scheduling/slots";
import { AutomationManager } from "@/components/admin/AutomationManager";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Automation & Scheduling Control",
  robots: { index: false, follow: false },
};

export default async function AdminAutomationPage(): Promise<React.JSX.Element> {
  const db = getDb();
  const [settings] = await db.select().from(automationSettings).limit(1);

  if (!settings) {
    return (
      <div className="p-8 rounded-2xl bg-surface border border-border text-center">
        Automation settings record not initialized. Please run database seeding.
      </div>
    );
  }

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const tomorrow = new Date(now.getTime() + 86400000);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  const todayOverride = await db.query.dateOverrides.findFirst({
    where: (d, { eq }) => eq(d.date, todayStr),
  });
  const tomorrowOverride = await db.query.dateOverrides.findFirst({
    where: (d, { eq }) => eq(d.date, tomorrowStr),
  });

  const todayDates = calculateDaySlotTimes(
    todayStr,
    settings,
    todayOverride || undefined,
  );
  const tomorrowDates = calculateDaySlotTimes(
    tomorrowStr,
    settings,
    tomorrowOverride || undefined,
  );

  const formatSlot = (d: Date) =>
    d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    }) + " UTC";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
          Automation & Scheduling Engine
        </h1>
        <p className="text-sm text-foreground-muted">
          Configure publication velocity, daily time distribution, topic
          rotation, and manual dispatch triggers.
        </p>
      </div>

      <AutomationManager
        initialSettings={settings}
        todaySlots={todayDates.map(formatSlot)}
        tomorrowSlots={tomorrowDates.map(formatSlot)}
      />
    </div>
  );
}
