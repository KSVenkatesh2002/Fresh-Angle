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
  maxPostsPerRun: z.number().int().min(1).max(3).optional(),
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
      const postId = await runDailyPipeline({ triggerSource: "manual" });
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
        { error: "Invalid settings format: " + parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 },
      );
    }

    const db = getDb();
    const [current] = await db.select().from(automationSettings).limit(1);

    // Validate window vs postsPerDay spacing if auto_distribute is active
    const targetMode = parsed.data.mode || current?.mode || "auto_distribute";
    if (targetMode === "auto_distribute") {
      const start = parsed.data.windowStart || current?.windowStart || "02:30";
      const end = parsed.data.windowEnd || current?.windowEnd || "11:30";
      const count = parsed.data.postsPerDay ?? current?.postsPerDay ?? 7;

      const [startH, startM] = start.split(":").map(Number);
      const [endH, endM] = end.split(":").map(Number);
      const startMinutes = (startH || 0) * 60 + (startM || 0);
      const endMinutes = (endH || 0) * 60 + (endM || 0);
      const windowSpan = endMinutes - startMinutes;

      if (windowSpan <= 0) {
        return NextResponse.json(
          { error: `Invalid window: window end (${end}) must be strictly after window start (${start}).` },
          { status: 400 },
        );
      }

      const nominalGap = count > 1 ? windowSpan / (count - 1) : windowSpan;
      if (nominalGap < 45) {
        return NextResponse.json(
          {
            error: `Window too narrow for ${count} posts: span is ${windowSpan} minutes, yielding only ~${Math.round(nominalGap)} min between slots (minimum allowed spacing is 45 minutes). Please expand window or decrease posts per day.`,
          },
          { status: 400 },
        );
      }
    }
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
