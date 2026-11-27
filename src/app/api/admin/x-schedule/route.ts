import { NextResponse } from "next/server";
import { z } from "zod";
import { isAuthenticated } from "@/lib/auth/session";
import {
  getXScheduleSettings,
  saveXScheduleSettings,
  reconcileTodayXSlots,
  getXTelemetry,
} from "@/services/scheduling/x-slots";
import { recordAuditLog } from "@/services/audit/logger";

const xScheduleSchema = z.object({
  extraXPostsPerDay: z.number().int().min(0).max(20).optional(),
  monthlyXCap: z.number().int().min(1).max(10000).optional(),
  xWindowStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  xWindowEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  xNoRepeatDays: z.number().int().min(1).max(365).optional(),
});

export async function GET(): Promise<NextResponse> {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [settings, telemetry] = await Promise.all([
    getXScheduleSettings(),
    getXTelemetry(),
  ]);
  return NextResponse.json({ settings, telemetry });
}

export async function POST(req: Request): Promise<NextResponse> {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = xScheduleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            "Invalid X schedule settings: " +
            parsed.error.issues.map((i) => i.message).join(", "),
        },
        { status: 400 },
      );
    }

    const current = await getXScheduleSettings();
    const nextStart = parsed.data.xWindowStart ?? current.xWindowStart;
    const nextEnd = parsed.data.xWindowEnd ?? current.xWindowEnd;
    if (nextEnd <= nextStart) {
      return NextResponse.json(
        { error: "X Window End must be strictly after X Window Start" },
        { status: 400 },
      );
    }

    const saved = await saveXScheduleSettings(parsed.data);
    const reconcile = await reconcileTodayXSlots(saved);
    const telemetry = await getXTelemetry();

    await recordAuditLog({
      action: "UPDATE_X_SCHEDULE_SETTINGS",
      entityType: "settings",
      entityId: "x_schedule_settings",
      details: { saved, reconcile },
    });

    return NextResponse.json({
      success: true,
      settings: saved,
      reconcile,
      telemetry,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}

