import React from "react";
import type { Metadata } from "next";
import {
  getTodayUsageStats,
  getMonthlyUsageAggregates,
  getAllUsageLimits,
} from "@/db/queries/usage";
import { BarChart3, AlertCircle, Info, Zap } from "lucide-react";

export const metadata: Metadata = {
  title: "Usage, Quotas & Provider Health",
  robots: { index: false, follow: false },
};

export default async function AdminUsagePage(): Promise<React.JSX.Element> {
  const [todayUsage, monthlyUsage, limits] = await Promise.all([
    getTodayUsageStats(),
    getMonthlyUsageAggregates(),
    getAllUsageLimits(),
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
    </div>
  );
}
