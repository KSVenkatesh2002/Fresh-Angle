import React from "react";
import type { Metadata } from "next";
import { getDb } from "@/db/client";
import { auditLog } from "@/db/schema";
import { desc } from "drizzle-orm";
import { ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Audit Log & Security History",
  robots: { index: false, follow: false },
};

export default async function AdminAuditPage(): Promise<React.JSX.Element> {
  const db = getDb();
  const logs = await db.query.auditLog.findMany({
    orderBy: [desc(auditLog.createdAt)],
    limit: 50,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
          Administrative Audit Log
        </h1>
        <p className="text-sm text-foreground-muted">
          Immutable trail of administrative updates, publishing decisions, and
          configuration modifications.
        </p>
      </div>

      <div className="p-6 rounded-2xl bg-surface border border-border space-y-4">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <span>Recent Administrative Transactions ({logs.length})</span>
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
                    <td className="py-2.5 px-3 text-foreground-muted">
                      {new Date(log.createdAt).toLocaleString()}
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
