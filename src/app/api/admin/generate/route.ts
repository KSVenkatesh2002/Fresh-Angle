import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth/session";
import { runDailyPipeline } from "@/services/pipeline/run";

export const maxDuration = 300; // 5 mins on Vercel Pro if available

export async function POST(): Promise<Response> {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Run pipeline asynchronously or inline
    const postId = await runDailyPipeline({ triggerSource: "manual" });
    return NextResponse.json({
      success: true,
      postId,
      message: "Pipeline executed and post created successfully",
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Pipeline failed: ${(error as Error).message}` },
      { status: 500 },
    );
  }
}
