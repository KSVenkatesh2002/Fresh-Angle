import React from "react";
import type { Metadata } from "next";
import {
  getTodayUsageStats,
  getMonthlyUsageAggregates,
  getAllUsageLimits,
} from "@/db/queries/usage";
import { getImageStorage } from "@/services/storage/cloudinary";
import {
  getDatabaseStorageStats,
  checkDatabaseStorageAlerts,
} from "@/services/maintenance/database";
import {
  BarChart3,
  AlertCircle,
  Info,
  Zap,
  Cloud,
  Database,
  Bell,
  HardDrive,
} from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Usage, Quotas & Provider Health",
  robots: { index: false, follow: false },
};

export default async function AdminUsagePage(): Promise<React.JSX.Element> {
  const [todayUsage, monthlyUsage, limits, cloudinaryStats, dbStats] = await Promise.all([
    getTodayUsageStats(),
    getMonthlyUsageAggregates(),
    getAllUsageLimits(),
    (async () => {
      try {
        return await getImageStorage().usage();
      } catch (err) {
        console.warn("Could not fetch Cloudinary usage:", err);
        return null;
      }
    })(),
    (async () => {
      try {
        const stats = await getDatabaseStorageStats();
        // Check for 70% and 90% quota thresholds
        await checkDatabaseStorageAlerts(stats);
        return stats;
      } catch (err) {
        console.warn("Could not fetch database stats:", err);
        return null;
      }
    })(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
          API Usage & Provider Quota Tracking
        </h1>
        <p className="text-sm text-foreground-muted">
          Real-time telemetry and quota utilization across AI and image
          synthesis infrastructure.
        </p>
      </div>

      {/* Free Tier Notice */}
      <div className="p-4 rounded-xl bg-surface border border-border flex items-start gap-3 text-xs text-foreground-muted">
        <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-foreground">
            Free-Tier Quota Accounting Note
          </p>
          <p className="leading-relaxed">
            Free-tier remaining quota is not exposed directly by external API
            endpoints. Metrics are measured locally per dispatch transaction. If
            multiple sites share a single API key, configure this
            instance&apos;s daily limit to the total quota divided by the number
            of sites.
          </p>
        </div>
      </div>

      {/* Cloudinary Dedicated Storage & CDN Quota Card */}
      {cloudinaryStats && (
        <div className="p-6 rounded-2xl bg-surface border border-border space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <Cloud className="w-5 h-5 text-primary" />
              <div>
                <h2 className="text-base font-bold text-foreground">
                  Cloudinary Image Storage & CDN
                </h2>
                <span className="text-xs text-foreground-muted">
                  Plan: {cloudinaryStats.plan} • Single Source of Truth for Blog Media
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                {cloudinaryStats.credits.usedPercent}% Credits Used
              </span>
              <span className="text-xs text-foreground-muted">
                {(cloudinaryStats.credits.limit - cloudinaryStats.credits.usage).toFixed(2)} Credits Available
              </span>
            </div>
          </div>

          {/* Credits Progress Bar */}
          <div className="space-y-1.5">
            <div className="w-full h-2.5 rounded-full bg-surface-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  cloudinaryStats.credits.usedPercent >= 90
                    ? "bg-danger"
                    : cloudinaryStats.credits.usedPercent >= 70
                      ? "bg-warning"
                      : "bg-success"
                }`}
                style={{ width: `${Math.max(2, Math.min(100, cloudinaryStats.credits.usedPercent))}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-foreground-muted">
              <span>{cloudinaryStats.credits.usage.toFixed(2)} credits used</span>
              <span>{cloudinaryStats.credits.limit} monthly free limit</span>
            </div>
          </div>

          {/* Granular Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-surface-muted border border-border">
              <span className="text-[11px] text-foreground-muted block">Total Objects</span>
              <span className="text-sm font-bold text-foreground">
                {cloudinaryStats.objects.usage.toLocaleString()} assets
              </span>
            </div>
            <div className="p-3 rounded-xl bg-surface-muted border border-border">
              <span className="text-[11px] text-foreground-muted block">Storage Used</span>
              <span className="text-sm font-bold text-foreground">
                {(cloudinaryStats.storage.usage / (1024 * 1024)).toFixed(2)} MB
              </span>
            </div>
            <div className="p-3 rounded-xl bg-surface-muted border border-border">
              <span className="text-[11px] text-foreground-muted block">Bandwidth Delivered</span>
              <span className="text-sm font-bold text-foreground">
                {(cloudinaryStats.bandwidth.usage / (1024 * 1024)).toFixed(2)} MB
              </span>
            </div>
            <div className="p-3 rounded-xl bg-surface-muted border border-border">
              <span className="text-[11px] text-foreground-muted block">Transformations</span>
              <span className="text-sm font-bold text-foreground">
                {cloudinaryStats.transformations.usage.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Neon PostgreSQL Database Storage Quota Card */}
      {dbStats && (
        <div className="p-6 rounded-2xl bg-surface border border-border space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <Database className="w-5 h-5 text-primary" />
              <div>
                <h2 className="text-base font-bold text-foreground">
                  Neon PostgreSQL Database Storage
                </h2>
                <span className="text-xs text-foreground-muted">
                  0.5 GB (512 MB) Free Tier Allocation • Scale-to-Zero Serverless
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                  dbStats.percentUsed >= 90
                    ? "bg-danger/10 text-danger border-danger/20"
                    : dbStats.percentUsed >= 70
                      ? "bg-warning/10 text-warning border-warning/20"
                      : "bg-primary/10 text-primary border-primary/20"
                }`}
              >
                {dbStats.percentUsed}% Utilized
              </span>
              <span className="text-xs text-foreground-muted">
                {dbStats.headroomMb} MB Available
              </span>
            </div>
          </div>

          {/* Database Storage Progress Bar */}
          <div className="space-y-1.5">
            <div className="w-full h-2.5 rounded-full bg-surface-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  dbStats.percentUsed >= 90
                    ? "bg-danger"
                    : dbStats.percentUsed >= 70
                      ? "bg-warning"
                      : "bg-success"
                }`}
                style={{ width: `${Math.max(2, Math.min(100, dbStats.percentUsed))}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-foreground-muted">
              <span>{dbStats.usedMb} MB consumed</span>
              <span>{dbStats.limitMb} MB free limit</span>
            </div>
          </div>

          {/* Alert Threshold Badges & Health Info */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs">
            <div className="flex items-center gap-2 text-foreground-muted">
              <Bell className="w-4 h-4 text-primary" />
              <span>
                Telegram Alerts Configured at <strong>70%</strong> ({Math.round(dbStats.limitMb * 0.7)} MB) &amp;{" "}
                <strong>90%</strong> ({Math.round(dbStats.limitMb * 0.9)} MB)
              </span>
            </div>
            <span className="text-success font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-success inline-block" />
              Health Normal ({dbStats.headroomMb} MB headroom)
            </span>
          </div>
        </div>
      )}

      {/* Limits & Today Usage Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {limits.map((limit) => {
          const today = todayUsage.find(
            (u) => u.provider === limit.provider && u.kind === limit.kind,
          );
          const currentCount =
            limit.kind === "image" ? today?.images || 0 : today?.calls || 0;
          const pct = Math.min(
            100,
            Math.round((currentCount / limit.dailyLimit) * 100),
          );
          const isSoftAlert = pct >= limit.softPercent;
          const isHardLimit = pct >= 100;

          return (
            <div
              key={limit.id}
              className="p-5 rounded-2xl bg-surface border border-border space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-foreground capitalize">
                    {limit.provider}
                  </h2>
                  <span className="text-xs text-primary font-medium uppercase tracking-wider">
                    {limit.kind}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-foreground-muted">
                  <Zap className="w-3.5 h-3.5 text-primary" />
                  <span>{pct}% utilized</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="w-full h-2 rounded-full bg-surface-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isHardLimit
                        ? "bg-danger"
                        : isSoftAlert
                          ? "bg-warning"
                          : "bg-primary"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-foreground-muted">
                  <span>{currentCount} consumed today</span>
                  <span>{limit.dailyLimit} daily max</span>
                </div>
              </div>

              {isSoftAlert && (
                <div className="p-2.5 rounded-lg bg-surface-muted border border-warning/30 text-warning text-xs flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Quota threshold warning ({pct}%)</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Monthly Summary Table */}
      <div className="p-6 rounded-2xl bg-surface border border-border space-y-4">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <span>Current Month Usage Aggregates</span>
        </h2>

        {monthlyUsage.length === 0 ? (
          <p className="text-xs text-foreground-muted">
            No usage recorded for this calendar month yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="border-b border-border text-foreground-muted uppercase font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Provider</th>
                  <th className="py-2.5 px-3">Kind</th>
                  <th className="py-2.5 px-3">Total Calls</th>
                  <th className="py-2.5 px-3">Tokens (In + Out)</th>
                  <th className="py-2.5 px-3">Images</th>
                  <th className="py-2.5 px-3">Errors</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-foreground">
                {monthlyUsage.map((row) => (
                  <tr
                    key={`${row.provider}_${row.kind}`}
                    className="hover:bg-surface-muted/50"
                  >
                    <td className="py-2.5 px-3 font-semibold capitalize">
                      {row.provider}
                    </td>
                    <td className="py-2.5 px-3 uppercase text-foreground-muted">
                      {row.kind}
                    </td>
                    <td className="py-2.5 px-3">{row.totalCalls}</td>
                    <td className="py-2.5 px-3 font-mono">
                      {row.totalTokens.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3">{row.totalImages}</td>
                    <td className="py-2.5 px-3 text-danger font-medium">
                      {row.totalErrors}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Largest Database Tables by Disk Footprint */}
      {dbStats && dbStats.topTables.length > 0 && (
        <div className="p-6 rounded-2xl bg-surface border border-border space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-primary" />
              <span>Largest Database Tables by Disk Footprint</span>
            </h2>
            <span className="text-xs text-foreground-muted">
              Total Database Footprint: <strong>{dbStats.usedMb} MB</strong>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="border-b border-border text-foreground-muted uppercase font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Table Name</th>
                  <th className="py-2.5 px-3">Total Size</th>
                  <th className="py-2.5 px-3">Table Data</th>
                  <th className="py-2.5 px-3">Indexes</th>
                  <th className="py-2.5 px-3">Share of DB</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-foreground">
                {dbStats.topTables.map((t) => (
                  <tr key={t.tableName} className="hover:bg-surface-muted/50">
                    <td className="py-2.5 px-3 font-mono font-semibold text-primary">
                      {t.tableName}
                    </td>
                    <td className="py-2.5 px-3 font-semibold">{t.totalSize}</td>
                    <td className="py-2.5 px-3 text-foreground-muted">{t.tableSize}</td>
                    <td className="py-2.5 px-3 text-foreground-muted">{t.indexSize}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-surface-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.min(100, Math.max(3, t.percentOfDatabase))}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] text-foreground-muted">
                          {t.percentOfDatabase}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
