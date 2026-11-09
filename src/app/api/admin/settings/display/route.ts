import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getDisplaySettings,
  saveDisplaySettings,
} from "@/services/settings/display";
import { recordAuditLog } from "@/services/audit/logger";

const updateSchema = z.object({
  showDeveloperFooter: z.boolean().optional(),
  showDeveloperPostCard: z.boolean().optional(),
  showDeveloperAboutPage: z.boolean().optional(),
  showPrimarySources: z.boolean().optional(),
});

export async function GET(): Promise<NextResponse> {
  try {
    const config = await getDisplaySettings();
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

    const updated = await saveDisplaySettings(parsed);

    await recordAuditLog({
      action: "UPDATE_DISPLAY_SETTINGS",
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
