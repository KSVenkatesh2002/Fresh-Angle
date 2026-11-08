import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db/client";
import { postSlots } from "@/db/schema";
import { eq } from "drizzle-orm";
import { recordAuditLog } from "@/services/audit/logger";
import { recordSlotEvent } from "@/services/scheduling/events";

const rescheduleSchema = z.object({
  slotId: z.string().uuid(),
  plannedAt: z.string().datetime().optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const json = await req.json();
    const parsed = rescheduleSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload: slotId must be a valid UUID" },
        { status: 400 },
      );
    }

    const { slotId, plannedAt } = parsed.data;
    const db = getDb();

    const slot = await db.query.postSlots.findFirst({
      where: eq(postSlots.id, slotId),
    });

    if (!slot) {
      return NextResponse.json(
        { error: `Slot not found: ${slotId}` },
        { status: 404 },
      );
    }

    // Default to immediate execution (1 minute from now so current or next tick picks it up)
    const newPlannedAt = plannedAt
      ? new Date(plannedAt)
      : new Date(Date.now() + 60 * 1000);

    const [updatedSlot] = await db
      .update(postSlots)
      .set({
        status: "planned",
        attempts: 0,
        error: null,
        plannedAt: newPlannedAt,
        startedAt: null,
        finishedAt: null,
      })
      .where(eq(postSlots.id, slotId))
      .returning();

    await recordSlotEvent({
      slotId: slot.id,
      eventType: "rescheduled",
      details: { previousPlannedAt: slot.plannedAt, newPlannedAt },
    });

    await recordAuditLog({
      action: "RESCHEDULE_SLOT",
      entityType: "post_slots",
      entityId: slot.id,
      details: {
        previousStatus: slot.status,
        previousPlannedAt: slot.plannedAt,
        newPlannedAt: newPlannedAt.toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Slot successfully rescheduled",
      slot: updatedSlot,
    });
  } catch (err: unknown) {
    const errorMsg = (err as Error).message || "Internal server error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

