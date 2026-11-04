import { NextRequest, NextResponse } from "next/server";
import { runSchedulerTick } from "@/services/scheduling/runner";
import { recordAuditLog } from "@/services/audit/logger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  return handleCronTick(req);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return handleCronTick(req);
}

async function handleCronTick(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET;

  if (
    expectedSecret &&
    authHeader !== `Bearer ${expectedSecret}` &&
    req.nextUrl.searchParams.get("secret") !== expectedSecret
  ) {
    return NextResponse.json({ error: "Unauthorized cron trigger" }, { status: 401 });
  }

  try {
    const result = await runSchedulerTick();
    await recordAuditLog({
      action: "CRON_TICK",
      entityType: "scheduler",
      details: result,
    });
    return NextResponse.json({ success: true, result });
  } catch (err) {
    console.error("Cron tick failed:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
