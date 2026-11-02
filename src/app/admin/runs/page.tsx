import React from "react";
import Link from "next/link";
import { getRecentRuns } from "@/db/queries/runs";
import { Container } from "@/components/layout/Container";
import { Badge } from "@/components/ui/Badge";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminRunsPage(): Promise<React.JSX.Element> {
  let runs: Awaited<ReturnType<typeof getRecentRuns>> = [];

  try {
    runs = await getRecentRuns(30);
  } catch (err) {
    console.warn(`⚠️ [AdminRuns] DB error: ${(err as Error).message}`);
  }

  return (
    <main className="py-8 sm:py-12">
      <Container>
        <div className="flex items-center justify-between pb-6 border-b border-border mb-8">
          <div>
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 text-xs text-foreground-muted hover:text-primary transition-colors mb-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Pipeline Execution Logs
            </h1>
          </div>
        </div>

        <div className="space-y-6">
          {runs.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-dashed border-border bg-surface text-foreground-muted">
              No pipeline run telemetry records found in the database.
            </div>
          ) : (
            runs.map((run) => (
              <div
                key={run.id}
                className="p-6 rounded-2xl bg-surface border border-border shadow-sm space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
                  <div className="flex items-center gap-3">
                    {run.status === "success" ? (
                      <Badge variant="success" className="gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Success</span>
                      </Badge>
                    ) : (
                      <Badge variant="warning" className="gap-1">
                        <XCircle className="w-3.5 h-3.5 text-danger" />
                        <span>{run.status}</span>
                      </Badge>
                    )}
                    <span className="text-sm font-semibold text-foreground">
                      Run #{run.id.slice(0, 8)}
                    </span>
                    <span className="text-xs text-foreground-muted font-mono">
                      {new Date(run.startedAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-foreground-muted">
                    <span>
                      Provider: <strong>{run.providerUsed || "N/A"}</strong>
                    </span>
                  </div>
                </div>

                {run.error && (
                  <div className="p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs font-mono">
                    {run.error}
                  </div>
                )}

                {/* Per-step breakdown */}
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-2">
                    Step Telemetry
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(run.steps || []).map((stepItem, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-surface-muted border border-border text-xs flex flex-col justify-between"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-[11px] font-semibold text-foreground">
                            {stepItem.step}
                          </span>
                          {stepItem.status === "success" ? (
                            <span className="text-success text-[10px]">✓</span>
                          ) : (
                            <span className="text-danger text-[10px]">✗</span>
                          )}
                        </div>
                        <span className="text-[10px] text-foreground-muted font-mono">
                          {stepItem.durationMs}ms
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Container>
    </main>
  );
}
