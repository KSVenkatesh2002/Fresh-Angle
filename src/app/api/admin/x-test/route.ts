import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth/session";
import { sendTestPostToX } from "@/services/notify/buffer";
import { recordAuditLog } from "@/services/audit/logger";

export async function POST(): Promise<NextResponse> {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendTestPostToX();

  await recordAuditLog({
    action: "X_TEST_POST",
    entityType: "buffer",
    details: { ...result },
  });

  return NextResponse.json(result, {
    status: result.success ? 200 : result.skipped ? 400 : 502,
  });
}
