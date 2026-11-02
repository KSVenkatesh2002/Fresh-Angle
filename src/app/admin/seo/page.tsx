import React from "react";
import type { Metadata } from "next";
import { getOrphanPosts } from "@/db/queries/links";
import { getPublishedPosts } from "@/db/queries/posts";
import { SeoPanel } from "@/components/admin/SeoPanel";

export const metadata: Metadata = {
  title: "SEO Audit & Syndication Tools",
  robots: { index: false, follow: false },
};

export default async function AdminSeoPage(): Promise<React.JSX.Element> {
  const [orphanPosts, { total }] = await Promise.all([
    getOrphanPosts(),
    getPublishedPosts({ page: 1, limit: 1 }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
          SEO Diagnostics & Engine Syndication
        </h1>
        <p className="text-sm text-foreground-muted">
          IndexNow instant search engine pings, internal link graph health, and
          crawl optimization checks.
        </p>
      </div>

      <SeoPanel orphanPosts={orphanPosts} totalPublished={total} />
    </div>
  );
}
