import { sql, eq, and, desc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { usageDaily, usageLimits, UsageDaily, UsageLimit } from "@/db/schema";

export async function getTodayUsageStats(): Promise<UsageDaily[]> {
  const db = getDb();
  const today = new Date().toISOString().split("T")[0];
  return db.query.usageDaily.findMany({
    where: eq(usageDaily.date, today),
    orderBy: [desc(usageDaily.calls)],
  });
}

export async function getMonthlyUsageAggregates(): Promise<
  Array<{
    provider: string;
    kind: string;
    totalCalls: number;
    totalImages: number;
    totalTokens: number;
    totalErrors: number;
  }>
> {
  const db = getDb();
  const currentMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'

  const rows = await db.execute<{
    provider: string;
    kind: string;
    totalCalls: number;
    totalImages: number;
    totalTokens: number;
    totalErrors: number;
  }>(sql`
    SELECT
      provider,
      kind,
      SUM(calls)::int as "totalCalls",
      SUM(images)::int as "totalImages",
      SUM(tokens_in + tokens_out)::int as "totalTokens",
      SUM(errors)::int as "totalErrors"
    FROM usage_daily
    WHERE date LIKE ${`${currentMonth}%`}
    GROUP BY provider, kind
    ORDER BY "totalCalls" DESC
  `);

  return Array.from(rows.rows || []);
}

export async function getAllUsageLimits(): Promise<UsageLimit[]> {
  const db = getDb();
  return db.query.usageLimits.findMany({
    orderBy: [usageLimits.provider],
  });
}

export async function updateUsageLimit(
  provider: string,
  kind: "text" | "image" | "embedding" | "news",
  data: { dailyLimit?: number; monthlyLimit?: number; softPercent?: number },
): Promise<void> {
  const db = getDb();
  await db
    .update(usageLimits)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(usageLimits.provider, provider), eq(usageLimits.kind, kind)));
}
