import { sql, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { settings } from "@/db/schema";
import { recordAuditLog } from "@/services/audit/logger";
import { sendDatabaseStorageAlert } from "@/services/notify/telegram";

export const FREE_TIER_DATABASE_LIMIT_BYTES = 512 * 1024 * 1024; // 0.5 GB (512 MB)
export const DEFAULT_RETENTION_DAYS = 90;
export const AUDIT_LOG_RETENTION_DAYS = 365;

export interface TableStorageSize {
  tableName: string;
  totalBytes: number;
  totalSize: string;
  tableSize: string;
  indexSize: string;
  percentOfDatabase: number;
}

export interface DatabaseStorageStats {
  usedBytes: number;
  limitBytes: number;
  usedMb: number;
  limitMb: number;
  percentUsed: number;
  headroomMb: number;
  topTables: TableStorageSize[];
}

export interface RetentionJobResult {
  success: boolean;
  retentionDays: number;
  auditRetentionDays: number;
  deletedCounts: {
    seenItems: number;
    pipelineRuns: number;
    postSlots: number;
    usageDaily: number;
    auditLog: number;
    dynamicTables: Record<string, number>;
  };
  totalDeleted: number;
  timestamp: string;
}

/**
 * Retrieves the configured data retention setting in days (default: 90).
 */
export async function getRetentionDaysSetting(): Promise<number> {
  try {
    const db = getDb();
    const row = await db.query.settings.findFirst({
      where: eq(settings.key, "data_retention_days"),
    });

    if (row && row.value) {
      const parsed = parseInt(row.value, 10);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("⚠️ [Database Health] Failed to read retention setting, using default 90 days:", err);
  }

  return DEFAULT_RETENTION_DAYS;
}

/**
 * Queries Neon PostgreSQL disk size and returns a breakdown of top tables.
 */
export async function getDatabaseStorageStats(): Promise<DatabaseStorageStats> {
  const db = getDb();

  // 1. Get total database size
  const sizeRes = await db.execute<{ db_bytes: string }>(
    sql`SELECT pg_database_size(current_database()) as db_bytes;`,
  );
  const rawBytes = sizeRes.rows?.[0]?.db_bytes;
  const usedBytes = rawBytes ? parseInt(rawBytes, 10) : 0;
  const limitBytes = FREE_TIER_DATABASE_LIMIT_BYTES;

  const usedMb = Math.round((usedBytes / (1024 * 1024)) * 100) / 100;
  const limitMb = Math.round(limitBytes / (1024 * 1024));
  const percentUsed = Math.round((usedBytes / limitBytes) * 100 * 10) / 10;
  const headroomMb = Math.max(0, Math.round((limitMb - usedMb) * 100) / 100);

  // 2. Get top tables by size
  const tablesRes = await db.execute<{
    table_name: string;
    total_bytes: string;
    total_size: string;
    table_size: string;
    index_size: string;
  }>(sql`
    SELECT 
      table_name,
      pg_total_relation_size(quote_ident(table_name)) as total_bytes,
      pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as total_size,
      pg_size_pretty(pg_relation_size(quote_ident(table_name))) as table_size,
      pg_size_pretty(pg_total_relation_size(quote_ident(table_name)) - pg_relation_size(quote_ident(table_name))) as index_size
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY pg_total_relation_size(quote_ident(table_name)) DESC
    LIMIT 10;
  `);

  const topTables: TableStorageSize[] = (tablesRes.rows || []).map((t) => {
    const bytes = parseInt(t.total_bytes, 10) || 0;
    const pct = usedBytes > 0 ? Math.round((bytes / usedBytes) * 100 * 10) / 10 : 0;
    return {
      tableName: t.table_name,
      totalBytes: bytes,
      totalSize: t.total_size,
      tableSize: t.table_size,
      indexSize: t.index_size,
      percentOfDatabase: pct,
    };
  });

  return {
    usedBytes,
    limitBytes,
    usedMb,
    limitMb,
    percentUsed,
    headroomMb,
    topTables,
  };
}

/**
 * Checks database size against 70% and 90% thresholds and triggers a Telegram alert once per day.
 */
export async function checkDatabaseStorageAlerts(
  stats?: DatabaseStorageStats,
): Promise<{ alerted: boolean; threshold?: 70 | 90 }> {
  const currentStats = stats || (await getDatabaseStorageStats());
  const today = new Date().toISOString().split("T")[0];
  const db = getDb();

  if (currentStats.percentUsed >= 90) {
    const row = await db.query.settings.findFirst({
      where: eq(settings.key, "last_db_alert_90_date"),
    });

    if (!row || row.value !== today) {
      await sendDatabaseStorageAlert({
        usedBytes: currentStats.usedBytes,
        limitBytes: currentStats.limitBytes,
        percent: currentStats.percentUsed,
        threshold: 90,
        topTables: currentStats.topTables,
      });

      await db
        .insert(settings)
        .values({
          key: "last_db_alert_90_date",
          value: today,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: today, updatedAt: new Date() },
        });

      return { alerted: true, threshold: 90 };
    }
  } else if (currentStats.percentUsed >= 70) {
    const row = await db.query.settings.findFirst({
      where: eq(settings.key, "last_db_alert_70_date"),
    });

    if (!row || row.value !== today) {
      await sendDatabaseStorageAlert({
        usedBytes: currentStats.usedBytes,
        limitBytes: currentStats.limitBytes,
        percent: currentStats.percentUsed,
        threshold: 70,
        topTables: currentStats.topTables,
      });

      await db
        .insert(settings)
        .values({
          key: "last_db_alert_70_date",
          value: today,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: today, updatedAt: new Date() },
        });

      return { alerted: true, threshold: 70 };
    }
  }

  return { alerted: false };
}

/**
 * Executes the database retention job:
 * - Purges rows older than N days (default 90) from seen_items, pipeline_runs (tick_runs),
 *   post_slots (slot_events), usage_daily (usage_events), notification_log.
 * - Purges rows older than 365 days from audit_log.
 * - NEVER touches posts, categories, tags, or post_sources.
 */
export async function runDatabaseRetentionJob(customDays?: number): Promise<RetentionJobResult> {
  const retentionDays = customDays || (await getRetentionDaysSetting());
  const auditRetentionDays = AUDIT_LOG_RETENTION_DAYS;
  const db = getDb();

  console.log(`🧹 [Retention Job] Starting cleanup (event retention: ${retentionDays}d, audit retention: ${auditRetentionDays}d)...`);

  const deletedCounts = {
    seenItems: 0,
    pipelineRuns: 0,
    postSlots: 0,
    usageDaily: 0,
    auditLog: 0,
    dynamicTables: {} as Record<string, number>,
  };

  // 1. seen_items (seen_at older than N days)
  const seenRes = await db.execute<{ count: string }>(sql`
    WITH deleted AS (
      DELETE FROM seen_items
      WHERE seen_at < NOW() - (${retentionDays} || ' days')::interval
      RETURNING id
    )
    SELECT COUNT(*)::text as count FROM deleted;
  `);
  deletedCounts.seenItems = parseInt(seenRes.rows?.[0]?.count || "0", 10);

  // 2. pipeline_runs (started_at older than N days)
  const runsRes = await db.execute<{ count: string }>(sql`
    WITH deleted AS (
      DELETE FROM pipeline_runs
      WHERE started_at < NOW() - (${retentionDays} || ' days')::interval
      RETURNING id
    )
    SELECT COUNT(*)::text as count FROM deleted;
  `);
  deletedCounts.pipelineRuns = parseInt(runsRes.rows?.[0]?.count || "0", 10);

  // 3. post_slots (completed/missed/failed/skipped slots older than N days)
  const slotsRes = await db.execute<{ count: string }>(sql`
    WITH deleted AS (
      DELETE FROM post_slots
      WHERE status IN ('done', 'missed', 'failed', 'skipped')
        AND planned_at < NOW() - (${retentionDays} || ' days')::interval
      RETURNING id
    )
    SELECT COUNT(*)::text as count FROM deleted;
  `);
  deletedCounts.postSlots = parseInt(slotsRes.rows?.[0]?.count || "0", 10);

  // 4. usage_daily (date older than N days)
  const usageRes = await db.execute<{ count: string }>(sql`
    WITH deleted AS (
      DELETE FROM usage_daily
      WHERE date < TO_CHAR(NOW() - (${retentionDays} || ' days')::interval, 'YYYY-MM-DD')
      RETURNING id
    )
    SELECT COUNT(*)::text as count FROM deleted;
  `);
  deletedCounts.usageDaily = parseInt(usageRes.rows?.[0]?.count || "0", 10);

  // 5. audit_log (created_at older than 365 days)
  const auditRes = await db.execute<{ count: string }>(sql`
    WITH deleted AS (
      DELETE FROM audit_log
      WHERE created_at < NOW() - (${auditRetentionDays} || ' days')::interval
      RETURNING id
    )
    SELECT COUNT(*)::text as count FROM deleted;
  `);
  deletedCounts.auditLog = parseInt(auditRes.rows?.[0]?.count || "0", 10);

  // 6. Check for dynamically named tables from prompt if they exist (notification_log, slot_events, tick_runs, usage_events)
  const dynamicCandidates = ["notification_log", "slot_events", "tick_runs", "usage_events"];
  for (const tableName of dynamicCandidates) {
    try {
      const checkTable = await db.execute<{ exists: boolean }>(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = ${tableName}
        ) as exists;
      `);
      if (checkTable.rows?.[0]?.exists) {
        const dynRes = await db.execute<{ count: string }>(sql`
          WITH deleted AS (
            DELETE FROM ${sql.raw(tableName)}
            WHERE created_at < NOW() - (${retentionDays} || ' days')::interval
            RETURNING id
          )
          SELECT COUNT(*)::text as count FROM deleted;
        `);
        deletedCounts.dynamicTables[tableName] = parseInt(dynRes.rows?.[0]?.count || "0", 10);
      }
    } catch {
      // Dynamic table optional
    }
  }

  const totalDeleted =
    deletedCounts.seenItems +
    deletedCounts.pipelineRuns +
    deletedCounts.postSlots +
    deletedCounts.usageDaily +
    deletedCounts.auditLog +
    Object.values(deletedCounts.dynamicTables).reduce((a, b) => a + b, 0);

  // Record audit log entry
  void recordAuditLog({
    action: "data_retention_cleanup",
    entityType: "system",
    details: {
      retentionDays,
      auditRetentionDays,
      deletedCounts,
      totalDeleted,
    },
  });

  console.log(
    `✓ [Retention Job] Completed. Deleted ${totalDeleted} expired log/event rows (seen: ${deletedCounts.seenItems}, runs: ${deletedCounts.pipelineRuns}, slots: ${deletedCounts.postSlots}, usage: ${deletedCounts.usageDaily}, audit: ${deletedCounts.auditLog}).`,
  );

  return {
    success: true,
    retentionDays,
    auditRetentionDays,
    deletedCounts,
    totalDeleted,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Runs daily maintenance from the tick:
 * Executes once every 24 hours.
 */
export async function runDailyDatabaseMaintenance(): Promise<{
  ran: boolean;
  retention?: RetentionJobResult;
  stats?: DatabaseStorageStats;
}> {
  const today = new Date().toISOString().split("T")[0];
  const db = getDb();

  const lastRunRow = await db.query.settings.findFirst({
    where: eq(settings.key, "last_retention_run_date"),
  });

  if (lastRunRow && lastRunRow.value === today) {
    // Already ran today
    return { ran: false };
  }

  console.log(`⏱️ [Maintenance] Running daily database retention and health check for ${today}...`);

  // 1. Run retention job
  const retention = await runDatabaseRetentionJob();

  // 2. Fetch storage stats and check threshold alerts
  const stats = await getDatabaseStorageStats();
  await checkDatabaseStorageAlerts(stats);

  // 3. Record today as completed
  await db
    .insert(settings)
    .values({
      key: "last_retention_run_date",
      value: today,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: today, updatedAt: new Date() },
    });

  return { ran: true, retention, stats };
}

