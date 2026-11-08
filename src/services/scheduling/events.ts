import { getDb } from "@/db/client";
import { slotEvents, SlotEvent } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function recordSlotEvent(params: {
  slotId: string;
  eventType: SlotEvent["eventType"];
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    const db = getDb();
    await db.insert(slotEvents).values({
      slotId: params.slotId,
      eventType: params.eventType,
      details: params.details || null,
      createdAt: new Date(),
    });
  } catch (err) {
    console.warn(`⚠️ [SlotEvent] Failed to record event "${params.eventType}" for slot ${params.slotId}:`, err);
  }
}

export async function getSlotEvents(slotId: string): Promise<SlotEvent[]> {
  const db = getDb();
  return db
    .select()
    .from(slotEvents)
    .where(eq(slotEvents.slotId, slotId))
    .orderBy(desc(slotEvents.createdAt));
}

