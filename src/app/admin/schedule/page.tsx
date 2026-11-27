import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db/client";
import { postSlots, topicQueue, categories, automationSettings } from "@/db/schema";
import { desc, asc, gte } from "drizzle-orm";
import { ensureUpcomingSlots } from "@/services/scheduling/slots";
import { ScheduleQueueManager } from "@/components/admin/ScheduleQueueManager";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Publishing Schedule & Topic Queue",
  robots: { index: false, follow: false },
};

export default async function AdminSchedulePage(): Promise<React.JSX.Element> {
  const db = getDb();

  await ensureUpcomingSlots().catch(() => {});

  const [slotsList, queueList, categoriesList, autoSettingsList] = await Promise.all([
    db.query.postSlots.findMany({
      where: gte(postSlots.plannedAt, new Date(Date.now() - 48 * 3600 * 1000)),
      orderBy: [asc(postSlots.plannedAt)],
      limit: 50,
    }),
    db.query.topicQueue.findMany({
      orderBy: [desc(topicQueue.priority), desc(topicQueue.createdAt)],
      limit: 30,
    }),
    db.query.categories.findMany({
      orderBy: [asc(categories.name)],
    }),
    db.select({ publishMode: automationSettings.publishMode }).from(automationSettings).limit(1),
  ]);

  const autoPublishOn = autoSettingsList[0]
    ? autoSettingsList[0].publishMode === "auto"
    : process.env.AUTO_PUBLISH === "true";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
            Publishing Calendar & Topic Queue
          </h1>
          <p className="text-sm text-foreground-muted">
            Manage upcoming distribution slots, bulk-import future research
            themes, and monitor queued items.
          </p>
        </div>
        <div className="px-3.5 py-2 rounded-xl border border-border bg-surface text-xs flex items-center gap-2">
          <span className="text-foreground-muted">Auto-publish new posts:</span>
          <strong className={autoPublishOn ? "text-success" : "text-warning"}>
            {autoPublishOn ? "ON" : "OFF"}
          </strong>
          <Link
            href="/admin/automation"
            className="text-primary hover:underline font-semibold ml-1"
          >
            Edit switch →
          </Link>
        </div>
      </div>

      <ScheduleQueueManager
        slots={slotsList}
        queue={queueList}
        categories={categoriesList}
      />
    </div>
  );
}
