import React from "react";
import type { Metadata } from "next";
import { getDb } from "@/db/client";
import { feeds } from "@/db/schema";
import { asc } from "drizzle-orm";
import { Rss, CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react";

export const metadata: Metadata = {
  title: "RSS Feeds & Ingestion Sources",
  robots: { index: false, follow: false },
};

export default async function AdminFeedsPage(): Promise<React.JSX.Element> {
  const db = getDb();
  const allFeeds = await db.query.feeds.findMany({
    orderBy: [asc(feeds.name)],
    with: { category: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
            RSS Feeds & Discovery Sources
          </h1>
          <p className="text-sm text-foreground-muted">
            Monitored industry publications and RSS feeds continuously polled
            for emerging breakthroughs.
          </p>
        </div>
      </div>

      <div className="p-6 rounded-2xl bg-surface border border-border space-y-4">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <Rss className="w-4 h-4 text-primary" />
          <span>Configured Ingestion Channels ({allFeeds.length})</span>
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="border-b border-border text-foreground-muted uppercase font-semibold">
              <tr>
                <th className="py-2.5 px-3">Feed Name</th>
                <th className="py-2.5 px-3">Track</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Last Checked</th>
                <th className="py-2.5 px-3">Items Ingested</th>
                <th className="py-2.5 px-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-foreground">
              {allFeeds.map((feed) => (
                <tr key={feed.id} className="hover:bg-surface-muted/50">
                  <td className="py-3 px-3 font-semibold">
                    <p>{feed.name}</p>
                    <a
                      href={feed.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-normal text-foreground-muted hover:text-primary transition-colors inline-flex items-center gap-1"
                    >
                      <span className="truncate max-w-xs">{feed.url}</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded-md bg-surface-muted border border-border text-xs">
                      {feed.category?.name || "General"}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${
                        feed.enabled
                          ? "bg-success/15 border-success/30 text-success"
                          : "bg-surface-muted border-border text-foreground-muted"
                      }`}
                    >
                      {feed.enabled ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <AlertTriangle className="w-3 h-3" />
                      )}
                      <span>{feed.enabled ? "Active" : "Disabled"}</span>
                    </span>
                  </td>
                  <td className="py-3 px-3 text-foreground-muted">
                    {feed.lastFetchAt
                      ? new Date(feed.lastFetchAt).toLocaleTimeString()
                      : "Pending"}
                  </td>
                  <td className="py-3 px-3 font-mono">{feed.itemCount}</td>
                  <td className="py-3 px-3">
                    <button
                      type="button"
                      className="px-2.5 py-1 rounded border border-border bg-surface-muted hover:border-primary text-foreground text-xs transition-colors"
                    >
                      Test Feed
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
