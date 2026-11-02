"use client";

import React, { useState } from "react";
import {
  Send,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Globe,
} from "lucide-react";

interface OrphanPost {
  id: string;
  title: string;
  slug: string;
}

interface SeoPanelProps {
  orphanPosts: OrphanPost[];
  totalPublished: number;
}

export function SeoPanel({
  orphanPosts,
  totalPublished,
}: SeoPanelProps): React.JSX.Element {
  const [pinging, setPinging] = useState(false);
  const [pingResult, setPingResult] = useState<string | null>(null);

  async function handlePing(): Promise<void> {
    setPinging(true);
    setPingResult(null);

    try {
      const res = await fetch("/api/admin/seo/ping", { method: "POST" });
      const data = await res.json();
      setPingResult(
        data.message || "Search engines pinged successfully via IndexNow",
      );
    } catch (err) {
      setPingResult(`Ping failed: ${(err as Error).message}`);
    } finally {
      setPinging(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Search Engine Ping Banner */}
      <div className="p-6 rounded-2xl bg-surface border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            <span>Search Engine Syndication & IndexNow</span>
          </h2>
          <p className="text-xs text-foreground-muted">
            Immediately broadcast updated URLs to Bing, Yandex, Seznam, and
            Naver search engines ({totalPublished} published posts in index).
          </p>
        </div>

        <button
          type="button"
          onClick={handlePing}
          disabled={pinging}
          className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2 shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
          <span>
            {pinging ? "Pinging Search Engines..." : "Ping Search Engines Now"}
          </span>
        </button>
      </div>

      {pingResult && (
        <div className="p-4 rounded-xl bg-surface border border-primary/40 text-xs text-primary flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{pingResult}</span>
        </div>
      )}

      {/* SEO Health Checklist */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-surface border border-border space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
            Indexing Readiness Checklist
          </h3>

          <ul className="space-y-2.5 text-xs text-foreground">
            <li className="flex items-center justify-between p-2 rounded-lg bg-surface-muted">
              <span>Sitemap Auto-Generation</span>
              <a
                href="/sitemap.xml"
                target="_blank"
                className="text-primary hover:underline inline-flex items-center gap-1 font-mono"
              >
                <span>/sitemap.xml</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </li>
            <li className="flex items-center justify-between p-2 rounded-lg bg-surface-muted">
              <span>Robots Protocol Policy</span>
              <a
                href="/robots.txt"
                target="_blank"
                className="text-primary hover:underline inline-flex items-center gap-1 font-mono"
              >
                <span>/robots.txt</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </li>
            <li className="flex items-center justify-between p-2 rounded-lg bg-surface-muted">
              <span>OpenSearch Engine Autodiscovery</span>
              <a
                href="/opensearch.xml"
                target="_blank"
                className="text-primary hover:underline inline-flex items-center gap-1 font-mono"
              >
                <span>/opensearch.xml</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </li>
            <li className="flex items-center justify-between p-2 rounded-lg bg-surface-muted">
              <span>OpenGraph Dynamic 1200x630 Card</span>
              <a
                href="/opengraph-image"
                target="_blank"
                className="text-primary hover:underline inline-flex items-center gap-1 font-mono"
              >
                <span>/opengraph-image</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </li>
          </ul>
        </div>

        {/* Orphan Posts Report */}
        <div className="p-6 rounded-2xl bg-surface border border-border space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              <span>Orphan Posts Report</span>
            </h3>
            <span className="text-xs px-2 py-0.5 rounded bg-surface-muted border border-border text-foreground-muted">
              {orphanPosts.length} orphans
            </span>
          </div>

          <p className="text-xs text-foreground-muted leading-relaxed">
            Posts with 0 inbound internal links. Link to these from newer
            dispatches to prevent search crawl dead-ends.
          </p>

          {orphanPosts.length === 0 ? (
            <div className="p-4 rounded-xl bg-surface-muted text-xs text-success flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                Excellent! All published dispatches have inbound internal links.
              </span>
            </div>
          ) : (
            <ul className="space-y-2 max-h-60 overflow-y-auto">
              {orphanPosts.map((post) => (
                <li
                  key={post.id}
                  className="p-2.5 rounded-lg bg-surface-muted border border-border flex items-center justify-between text-xs"
                >
                  <span className="font-medium text-foreground truncate max-w-xs">
                    {post.title}
                  </span>
                  <a
                    href={`/blog/${post.slug}`}
                    target="_blank"
                    className="text-primary hover:underline text-[11px] shrink-0"
                  >
                    View
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
