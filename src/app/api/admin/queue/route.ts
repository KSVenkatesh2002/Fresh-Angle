import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db/client";
import { topicQueue } from "@/db/schema";
import { eq } from "drizzle-orm";

const bulkImportSchema = z.object({
  titles: z.array(z.string().min(3)).min(1),
  categoryId: z.string().uuid().optional(),
  priority: z.number().int().default(1),
});

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const json = await req.json();

    if (json.action === "bulk_import") {
      const parsed = bulkImportSchema.safeParse(json);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid bulk import payload" },
          { status: 400 },
        );
      }

      const db = getDb();
      await db.insert(topicQueue).values(
        parsed.data.titles.map((title) => ({
          title: title.trim(),
          categoryId: parsed.data.categoryId || null,
          priority: parsed.data.priority,
          status: "queued" as const,
        })),
      );

      return NextResponse.json({
        success: true,
        count: parsed.data.titles.length,
      });
    }

    if (json.action === "cancel" && json.id) {
      const db = getDb();
      await db
        .update(topicQueue)
        .set({ status: "cancelled" })
        .where(eq(topicQueue.id, json.id));
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
