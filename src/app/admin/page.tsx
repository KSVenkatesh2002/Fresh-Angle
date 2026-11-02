import React from "react";
import Link from "next/link";
import { getPublishedPosts } from "@/db/queries/posts";
import { getRecentRuns } from "@/db/queries/runs";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils/dates";
import { AdminActions } from "./AdminActions";
import {
  Activity,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Cpu,
} from "lucide-react";

import { getDb } from "@/db/client";
import { automationSettings, postSlots } from "@/db/schema";
import { eq, and, gte, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage(): Promise<React.JSX.Element> {
  const db = getDb();
  let runs: Awaited<ReturnType<typeof getRecentRuns>> = [];
  let postsData: Awaited<ReturnType<typeof getPublishedPosts>>["posts"] = [];
  let settingsRecord: typeof automationSettings.$inferSelect | null = null;
  let upcomingSlot: typeof postSlots.$inferSelect | null = null;

  try {
    const [recentRuns, allPosts, [settings], nextSlots] = await Promise.all([
      getRecentRuns(10),
      getPublishedPosts({ page: 1, limit: 15 }),
      db.select().from(automationSettings).limit(1),
      db.query.postSlots.findMany({
        where: and(
          eq(postSlots.status, "planned"),
          gte(postSlots.plannedAt, new Date()),
        ),
        orderBy: [asc(postSlots.plannedAt)],
        limit: 1,
      }),
    ]);
    runs = recentRuns;
    postsData = allPosts.posts;
    settingsRecord = settings;
    upcomingSlot = nextSlots[0];
  } catch (err) {
    console.warn(
      `⚠️ [Admin] Could not fetch records: ${(err as Error).message}`,
    );
  }

  const latestRun = runs[0];

  return (
    <div className="space-y-8">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border mb-8">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-primary mb-1 block">
            Control Panel
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Editorial Operations
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <AdminActions />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        <div className="p-5 rounded-2xl bg-surface border border-border shadow-sm space-y-1">
          <div className="flex items-center justify-between text-foreground-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Total Published
            </span>
            <FileText className="w-4 h-4 text-primary" />
          </div>
          <p className="text-2xl font-extrabold text-foreground">
            {postsData.length}
          </p>
          <p className="text-[11px] text-foreground-muted">
            Live technical dispatches
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-surface border border-border shadow-sm space-y-1">
          <div className="flex items-center justify-between text-foreground-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Pipeline Health
            </span>
            <Activity className="w-4 h-4 text-success" />
          </div>
          <p className="text-2xl font-extrabold text-foreground">
            {latestRun?.status === "success" ? (
              <span className="text-success">Nominal</span>
            ) : latestRun?.status === "failed" ? (
              <span className="text-danger">Failed</span>
            ) : (
              <span className="text-warning">Ready</span>
            )}
          </p>
          <p className="text-[11px] text-foreground-muted">
            {latestRun?.finishedAt
              ? `Last run ${formatDate(latestRun.finishedAt)}`
              : "Awaiting first run"}
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-surface border border-border shadow-sm space-y-1">
          <div className="flex items-center justify-between text-foreground-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Automation Engine
            </span>
            <Cpu className="w-4 h-4 text-primary" />
          </div>
          <p className="text-2xl font-extrabold text-foreground">
            {settingsRecord?.enabled ? (
              <span className="text-success">Active</span>
            ) : (
              <span className="text-foreground-muted">Paused</span>
            )}
          </p>
          <p className="text-[11px] text-foreground-muted truncate">
            {upcomingSlot
              ? `Next slot: ${new Date(upcomingSlot.plannedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })} UTC`
              : "No pending slot"}
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-surface border border-border shadow-sm space-y-1">
          <div className="flex items-center justify-between text-foreground-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Active AI Engine
            </span>
            <Clock className="w-4 h-4 text-primary" />
          </div>
          <p className="text-lg font-bold text-foreground truncate">
            {latestRun?.providerUsed ||
              process.env.GROQ_MODEL ||
              "Groq / Gemini"}
          </p>
          <p className="text-[11px] text-foreground-muted">
            Dual Fallback Chain
          </p>
        </div>
      </div>

      {/* Recent Runs Table */}
      <section aria-labelledby="recent-runs-heading" className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2
            id="recent-runs-heading"
            className="text-lg font-bold text-foreground"
          >
            Recent Pipeline Telemetry
          </h2>
          <Link
            href="/admin/runs"
            className="text-xs text-primary hover:underline underline-offset-4"
          >
            View detailed step logs →
          </Link>
        </div>

        <div className="border border-border rounded-xl bg-surface overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-xs font-semibold text-foreground-muted uppercase tracking-wider">
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Started At</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Provider</th>
                <th className="py-3 px-4">Error / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {runs.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-8 text-center text-foreground-muted"
                  >
                    No automated pipeline executions logged yet. Click
                    &ldquo;Trigger Pipeline Now&rdquo; to test.
                  </td>
                </tr>
              ) : (
                runs.map((run) => {
                  const duration =
                    run.finishedAt && run.startedAt
                      ? `${Math.round(
                          (new Date(run.finishedAt).getTime() -
                            new Date(run.startedAt).getTime()) /
                            1000,
                        )}s`
                      : "Running...";

                  return (
                    <tr
                      key={run.id}
                      className="hover:bg-surface-muted/40 transition-colors"
                    >
                      <td className="py-3 px-4">
                        {run.status === "success" ? (
                          <Badge variant="success" className="gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Success</span>
                          </Badge>
                        ) : run.status === "failed" ? (
                          <Badge variant="warning" className="gap-1">
                            <XCircle className="w-3 h-3 text-danger" />
                            <span>Failed</span>
                          </Badge>
                        ) : (
                          <Badge variant="default" className="gap-1">
                            <AlertTriangle className="w-3 h-3 text-warning" />
                            <span>{run.status}</span>
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-foreground-muted">
                        {new Date(run.startedAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-xs text-foreground font-mono">
                        {duration}
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-foreground">
                        {run.providerUsed || "N/A"}
                      </td>
                      <td className="py-3 px-4 text-xs text-foreground-muted max-w-xs truncate">
                        {run.error || "All 8 pipeline stages passed."}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Post Management Table */}
      <section aria-labelledby="post-management-heading">
        <div className="flex items-center justify-between mb-4">
          <h2
            id="post-management-heading"
            className="text-lg font-bold text-foreground"
          >
            Published Briefings
          </h2>
        </div>

        <div className="border border-border rounded-xl bg-surface overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-xs font-semibold text-foreground-muted uppercase tracking-wider">
                <th className="py-3 px-4">Title</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Published</th>
                <th className="py-3 px-4">Read Time</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {postsData.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-8 text-center text-foreground-muted"
                  >
                    No posts currently saved in database.
                  </td>
                </tr>
              ) : (
                postsData.map((post) => (
                  <tr
                    key={post.id}
                    className="hover:bg-surface-muted/40 transition-colors"
                  >
                    <td className="py-3 px-4 font-medium text-foreground max-w-sm truncate">
                      <Link
                        href={`/blog/${post.slug}`}
                        className="hover:text-primary transition-colors flex items-center gap-1.5"
                        target="_blank"
                      >
                        <span>{post.title}</span>
                        <ExternalLink className="w-3 h-3 text-foreground-muted" />
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline">
                        {post.category?.name || "Uncategorized"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-xs text-foreground-muted">
                      {formatDate(post.publishedAt)}
                    </td>
                    <td className="py-3 px-4 text-xs text-foreground font-mono">
                      {post.readingTimeMin} min
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-xs text-success font-medium">
                        Published
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
