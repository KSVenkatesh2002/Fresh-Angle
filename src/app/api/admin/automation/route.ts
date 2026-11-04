import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db/client";
import { automationSettings } from "@/db/schema";
import { runSchedulerTick } from "@/services/scheduling/runner";
import { runDailyPipeline } from "@/services/pipeline/run";
import { syncPostSlotsForDate } from "@/services/scheduling/slots";
import { recordAuditLog } from "@/services/audit/logger";

const updateSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  mode: z.enum(["auto_distribute", "fixed_times"]).optional(),
  postsPerDay: z.number().int().min(1).max(24).optional(),
  windowStart: z.string().optional(),
  windowEnd: z.string().optional(),
  fixedTimes: z.array(z.string()).optional(),
  jitterMinutes: z.number().int().min(0).max(60).optional(),
  publishMode: z.enum(["auto", "review"]).optional(),
  contentMode: z
    .enum(["trending", "evergreen", "queue_only", "mixed"])
    .optional(),
  maxPostsPerRun: z.number().int().min(1).max(5).optional(),
  lateSlotGraceMinutes: z.number().int().min(15).max(360).optional(),
  pausedUntil: z.string().nullable().optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const json = await req.json();
    const action = json.action;

    if (action === "run_tick") {
      const tickResult = await runSchedulerTick();
      await recordAuditLog({
        action: "TRIGGER_TICK",
        entityType: "scheduler",
        details: { result: tickResult },
      });
      return NextResponse.json({ success: true, result: tickResult });
    }

    if (action === "generate_now") {
      await recordAuditLog({
        action: "GENERATE_NOW_REQUESTED",
        entityType: "pipeline",
        details: { trigger: "admin_manual" },
      });

      // Check GitHub dispatch token if available, or trigger pipeline directly
      const token = process.env.GH_DISPATCH_TOKEN || process.env.GITHUB_DISPATCH_TOKEN;
      const repo = process.env.GH_REPO || process.env.GITHUB_REPO;

      if (token && repo) {
        try {
          const res = await fetch(
            `https://api.github.com/repos/${repo}/actions/workflows/generate-now.yml/dispatches`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github.v3+json",
                "User-Agent": "FreshAngle-Admin",
              },
              body: JSON.stringify({ ref: "main" }),
            },
          );
          if (res.ok) {
            return NextResponse.json({
              success: true,
              message: "Dispatched generation workflow on GitHub Actions",
            });
          }
        } catch {
          // Fallback to local execution
        }
      }

      // Execute directly in background / async
      const postId = await runDailyPipeline();
      return NextResponse.json({
        success: true,
        postId,
        message: "Generation complete!",
      });
    }

    // Otherwise handle update settings
    const parsed = updateSettingsSchema.safeParse(json.settings);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid settings format" },
        { status: 400 },
      );
    }

    const db = getDb();
    await db.update(automationSettings).set({
      ...parsed.data,
      pausedUntil: parsed.data.pausedUntil
        ? new Date(parsed.data.pausedUntil)
        : null,
      updatedAt: new Date(),
    });

    // Immediately regenerate planned slots for today & tomorrow with new parameters
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const tomorrowStr = new Date(now.getTime() + 86400000).toISOString().split("T")[0];
    await syncPostSlotsForDate(todayStr, true);
    await syncPostSlotsForDate(tomorrowStr, true);

    await recordAuditLog({
      action: "UPDATE_AUTOMATION_SETTINGS",
      entityType: "automation_settings",
      details: parsed.data,
    });

    return NextResponse.json({ success: true });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to update automation settings:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
