import React from "react";
import type { Metadata } from "next";
import { getDb } from "@/db/client";
import { postSlots, topicQueue, categories } from "@/db/schema";
import { desc, asc } from "drizzle-orm";
import { ScheduleQueueManager } from "@/components/admin/ScheduleQueueManager";

export const metadata: Metadata = {
  title: "Publishing Schedule & Topic Queue",
  robots: { index: false, follow: false },
};

export default async function AdminSchedulePage(): Promise<React.JSX.Element> {
  const db = getDb();
  const [slotsList, queueList, categoriesList] = await Promise.all([
    db.query.postSlots.findMany({
      orderBy: [asc(postSlots.plannedAt)],
      limit: 25,
    }),
    db.query.topicQueue.findMany({
      orderBy: [desc(topicQueue.priority), desc(topicQueue.createdAt)],
      limit: 30,
    }),
    db.query.categories.findMany({
      orderBy: [asc(categories.name)],
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
          Publishing Calendar & Topic Queue
        </h1>
        <p className="text-sm text-foreground-muted">
          Manage upcoming distribution slots, bulk-import future research
          themes, and monitor queued items.
        </p>
      </div>

      <ScheduleQueueManager
        slots={slotsList}
        queue={queueList}
        categories={categoriesList}
      />
    </div>
  );
}
