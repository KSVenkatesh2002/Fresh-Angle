import React from "react";
import type { Metadata } from "next";
import { getDb } from "@/db/client";
import { auditLog, slotEvents } from "@/db/schema";
import { desc } from "drizzle-orm";
import { ShieldCheck, CalendarClock } from "lucide-react";
import { formatDualTime } from "@/lib/utils/time";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Audit Log & Slot History",
  robots: { index: false, follow: false },
};

export default async function AdminAuditPage(): Promise<React.JSX.Element> {
  const db = getDb();
  const [logs, slotHistory] = await Promise.all([
    db.query.auditLog.findMany({
      orderBy: [desc(auditLog.createdAt)],
      limit: 50,
    }),
    db.query.slotEvents.findMany({
      orderBy: [desc(slotEvents.createdAt)],
      limit: 50,
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
          System Audit & Event Logs
        </h1>
        <p className="text-sm text-foreground-muted">
          Immutable trail of administrative updates, publishing decisions, and post slot transitions.
        </p>
      </div>

      {/* Post Slot Lifecycle Events */}
      <div className="p-6 rounded-2xl bg-surface border border-border space-y-4">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-primary" />
          <span>Post Slot State Transitions & Lifecycle ({slotHistory.length})</span>
        </h2>

        {slotHistory.length === 0 ? (
          <p className="text-xs text-foreground-muted">
            No slot events logged yet. Events will appear here when slots are claimed, published, missed, or rescheduled.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="border-b border-border text-foreground-muted uppercase font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Slot ID</th>
                  <th className="py-2.5 px-3">Event Type</th>
                  <th className="py-2.5 px-3">Details / Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-foreground font-mono">
                {slotHistory.map((event) => (
                  <tr key={event.id} className="hover:bg-surface-muted/50">
                    <td className="py-2.5 px-3 text-foreground-muted whitespace-nowrap">
                      {formatDualTime(event.createdAt)}
                    </td>
                    <td className="py-2.5 px-3 text-primary truncate max-w-[140px]" title={event.slotId}>
                      {event.slotId.slice(0, 8)}...
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        event.eventType === "published"
                          ? "bg-success/10 text-success border border-success/30"
                          : event.eventType === "claimed"
                            ? "bg-primary/10 text-primary border border-primary/30"
                            : event.eventType === "failed" || event.eventType === "missed"
                              ? "bg-danger/10 text-danger border border-danger/30"
                              : "bg-surface-muted text-foreground-muted border border-border"
                      }`}>
                        {event.eventType}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-sans text-foreground-muted">
                      {event.details ? JSON.stringify(event.details) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Admin Actions */}
      <div className="p-6 rounded-2xl bg-surface border border-border space-y-4">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <span>Administrative Audit Trail ({logs.length})</span>
        </h2>

        {logs.length === 0 ? (
          <p className="text-xs text-foreground-muted">
            No administrative actions logged yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="border-b border-border text-foreground-muted uppercase font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Actor</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Target Entity</th>
                  <th className="py-2.5 px-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-foreground font-mono">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-surface-muted/50">
                    <td className="py-2.5 px-3 text-foreground-muted whitespace-nowrap">
                      {formatDualTime(log.createdAt)}
                    </td>
                    <td className="py-2.5 px-3 text-primary">
                      {log.ipAddress || "admin"}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-foreground uppercase">
                      {log.action}
                    </td>
                    <td className="py-2.5 px-3 text-foreground-muted">
                      {log.entityType}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-foreground-muted">
                      {JSON.stringify(log.details)}
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
