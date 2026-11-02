import { sql, eq, and } from "drizzle-orm";
import { getDb } from "@/db/client";
import { usageDaily, usageLimits } from "@/db/schema";
import { sendTelegramMessage } from "@/services/notify/telegram";
import { siteConfig } from "@/config/site";

export interface RecordUsageParams {
  provider: string;
  kind: "text" | "image" | "embedding" | "news";
  tokensIn?: number;
  tokensOut?: number;
  images?: number;
  isError?: boolean;
}

export async function recordUsage(params: RecordUsageParams): Promise<void> {
  const db = getDb();
  const today = new Date().toISOString().split("T")[0];
  const callsDelta = params.isError ? 0 : 1;
  const errorsDelta = params.isError ? 1 : 0;
  const tokensInDelta = params.tokensIn || 0;
  const tokensOutDelta = params.tokensOut || 0;
  const imagesDelta = params.images || 0;

  try {
    await db
      .insert(usageDaily)
      .values({
        date: today,
        provider: params.provider,
        kind: params.kind,
        calls: callsDelta,
        tokensIn: tokensInDelta,
        tokensOut: tokensOutDelta,
        images: imagesDelta,
        errors: errorsDelta,
      })
      .onConflictDoUpdate({
        target: [usageDaily.date, usageDaily.provider, usageDaily.kind],
        set: {
          calls: sql`${usageDaily.calls} + ${callsDelta}`,
          tokensIn: sql`${usageDaily.tokensIn} + ${tokensInDelta}`,
          tokensOut: sql`${usageDaily.tokensOut} + ${tokensOutDelta}`,
          images: sql`${usageDaily.images} + ${imagesDelta}`,
          errors: sql`${usageDaily.errors} + ${errorsDelta}`,
        },
      });

    // Check soft limits and alert if needed
    await verifyUsageThreshold(params.provider, params.kind, today);
  } catch (err) {
    console.warn(
      `⚠️ [UsageTracker] Failed to record usage: ${(err as Error).message}`,
    );
  }
}

async function verifyUsageThreshold(
  provider: string,
  kind: "text" | "image" | "embedding" | "news",
  today: string,
): Promise<void> {
  const db = getDb();
  const limitRow = await db.query.usageLimits.findFirst({
    where: and(eq(usageLimits.provider, provider), eq(usageLimits.kind, kind)),
  });

  if (!limitRow || limitRow.dailyLimit <= 0) return;

  const dailyRow = await db.query.usageDaily.findFirst({
    where: and(
      eq(usageDaily.date, today),
      eq(usageDaily.provider, provider),
      eq(usageDaily.kind, kind),
    ),
  });

  if (!dailyRow) return;

  const currentCount = kind === "image" ? dailyRow.images : dailyRow.calls;
  const softThreshold = Math.floor(
    (limitRow.dailyLimit * limitRow.softPercent) / 100,
  );

  if (currentCount === softThreshold) {
    await sendTelegramMessage(
      `[${siteConfig.name}] ⚠️ <b>Usage Alert: ${limitRow.softPercent}% reached</b>\n\n` +
        `Provider: <b>${provider}</b> (${kind})\n` +
        `Current: ${currentCount} / ${limitRow.dailyLimit} daily limit`,
    );
  } else if (currentCount >= limitRow.dailyLimit) {
    await sendTelegramMessage(
      `[${siteConfig.name}] 🛑 <b>Daily Limit Exceeded</b>\n\n` +
        `Provider: <b>${provider}</b> (${kind})\n` +
        `Reached maximum ${limitRow.dailyLimit} allowed daily calls.`,
    );
  }
}
