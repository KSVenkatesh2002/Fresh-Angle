import React from "react";
import type { Metadata } from "next";
import { getDb } from "@/db/client";
import { postSlots, topicQueue, categories } from "@/db/schema";
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

  const [slotsList, queueList, categoriesList] = await Promise.all([
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
