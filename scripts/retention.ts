/**
 * Database Health & Retention Maintenance Script
 *
 * Usage:
 *   NODE_OPTIONS="--dns-result-order=ipv4first" pnpm tsx --env-file=.env scripts/retention.ts
 *   NODE_OPTIONS="--dns-result-order=ipv4first" pnpm tsx --env-file=.env scripts/retention.ts --days=90
 *   NODE_OPTIONS="--dns-result-order=ipv4first" pnpm tsx --env-file=.env scripts/retention.ts --stats-only
 */

import {
  runDatabaseRetentionJob,
  getDatabaseStorageStats,
  checkDatabaseStorageAlerts,
} from "../src/services/maintenance/database";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const isStatsOnly = args.includes("--stats-only");
  const daysArg = args.find((a) => a.startsWith("--days="));
  const customDays = daysArg ? parseInt(daysArg.split("=")[1], 10) : undefined;

  console.log("🏥 [Database Health] Inspecting Neon PostgreSQL storage & tables...\n");

  const stats = await getDatabaseStorageStats();
  console.log("================ DATABASE STORAGE ================");
  console.log(`Current Size:      ${stats.usedMb} MB / ${stats.limitMb} MB (${stats.percentUsed}% used)`);
  console.log(`Free Headroom:     ${stats.headroomMb} MB remaining`);
  console.log("---------------- TOP TABLES ----------------------");
  for (const t of stats.topTables) {
    console.log(
      `• ${t.tableName.padEnd(20)} ${t.totalSize.padStart(10)} (data: ${t.tableSize}, idx: ${t.indexSize}) - ${t.percentOfDatabase}%`,
    );
  }
  console.log("==================================================\n");

  if (isStatsOnly) {
    return;
  }

  // Run retention cleanup
  console.log("🧹 Running retention cleanup...");
  const retentionResult = await runDatabaseRetentionJob(customDays);

  console.log("\n================ RETENTION REPORT ================");
  console.log(`Retention Window:  ${retentionResult.retentionDays} days (audit_log: ${retentionResult.auditRetentionDays} days)`);
  console.log(`Seen Items Purged: ${retentionResult.deletedCounts.seenItems}`);
  console.log(`Pipeline Runs:     ${retentionResult.deletedCounts.pipelineRuns}`);
  console.log(`Expired Slots:     ${retentionResult.deletedCounts.postSlots}`);
  console.log(`Usage Records:     ${retentionResult.deletedCounts.usageDaily}`);
  console.log(`Audit Log Rows:    ${retentionResult.deletedCounts.auditLog}`);
  console.log(`Total Rows Purged: ${retentionResult.totalDeleted}`);
  console.log("==================================================");

  // Check alert thresholds
  const alertCheck = await checkDatabaseStorageAlerts(stats);
  if (alertCheck.alerted) {
    console.log(`🚨 Triggered ${alertCheck.threshold}% storage alert to Telegram!`);
  } else {
    console.log(`✓ Storage alert status: normal (${stats.percentUsed}% < 70% threshold).`);
  }
}

main().catch((err) => {
  console.error("❌ Fatal maintenance error:", err);
  process.exit(1);
});

