import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getNotificationSettings,
  saveNotificationSettings,
  NotificationChannelMode,
} from "@/services/notify/settings";
import { recordAuditLog } from "@/services/audit/logger";

const modeSchema = z.enum(["loud", "silent", "disabled"]);

const updateSchema = z.object({
  postPublished: modeSchema.optional(),
  postDraftTest: modeSchema.optional(),
  pipelineFailure: modeSchema.optional(),
  schedulerDisruption: modeSchema.optional(),
  quotaUsageAlerts: modeSchema.optional(),
  dbStorageAlerts: modeSchema.optional(),
  contactFormAlerts: modeSchema.optional(),
});

export async function GET(): Promise<NextResponse> {
  try {
    const config = await getNotificationSettings();
    return NextResponse.json({ success: true, settings: config });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = await req.json();
    const parsed = updateSchema.parse(body);

    const updated = await saveNotificationSettings(
      parsed as Record<string, NotificationChannelMode>,
    );

    await recordAuditLog({
      action: "UPDATE_NOTIFICATION_SETTINGS",
      entityType: "settings",
      details: { ...updated },
    });

    return NextResponse.json({ success: true, settings: updated });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }
}
