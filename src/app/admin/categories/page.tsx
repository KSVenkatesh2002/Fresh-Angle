import React from "react";
import type { Metadata } from "next";
import { getCategoriesWithCounts } from "@/db/queries/categories";
import { getTagsWithCounts } from "@/db/queries/tags";
import { FolderGit2, Hash, ExternalLink } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Categories & Tags Taxonomy",
  robots: { index: false, follow: false },
};

export default async function AdminCategoriesPage(): Promise<React.JSX.Element> {
  const [categoriesList, tagsList] = await Promise.all([
    getCategoriesWithCounts(),
    getTagsWithCounts(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
          Taxonomy & Ontology Architecture
        </h1>
        <p className="text-sm text-foreground-muted">
          Manage research tracks, category hub descriptions, and granular entity
          tags.
        </p>
      </div>

      {/* Categories / Tracks */}
      <div className="p-6 rounded-2xl bg-surface border border-border space-y-4">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <FolderGit2 className="w-4 h-4 text-primary" />
          <span>Research Tracks & Hubs ({categoriesList.length})</span>
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="border-b border-border text-foreground-muted uppercase font-semibold">
              <tr>
                <th className="py-2.5 px-3">Track Name</th>
                <th className="py-2.5 px-3">Slug</th>
                <th className="py-2.5 px-3">Hub Overview / Description</th>
                <th className="py-2.5 px-3">Dispatches</th>
                <th className="py-2.5 px-3">Public Hub</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-foreground">
              {categoriesList.map((cat) => (
                <tr key={cat.id} className="hover:bg-surface-muted/50">
                  <td className="py-3 px-3 font-semibold">{cat.name}</td>
                  <td className="py-3 px-3 font-mono text-foreground-muted">
                    {cat.slug}
                  </td>
                  <td className="py-3 px-3 max-w-md text-foreground-muted leading-relaxed">
                    {cat.introText ||
                      cat.description ||
                      "No description configured"}
                  </td>
                  <td className="py-3 px-3 font-mono font-semibold">
                    {cat.postCount}
                  </td>
                  <td className="py-3 px-3">
                    <Link
                      href={`/category/${cat.slug}`}
                      target="_blank"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <span>Visit</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tags */}
      <div className="p-6 rounded-2xl bg-surface border border-border space-y-4">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <Hash className="w-4 h-4 text-primary" />
          <span>Indexing Tags & Technical Entities ({tagsList.length})</span>
        </h2>

        <div className="flex flex-wrap gap-2.5">
          {tagsList.map((tag) => (
            <Link
              key={tag.id}
              href={`/tag/${tag.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-muted border border-border hover:border-primary/50 text-xs font-medium text-foreground transition-colors"
            >
              <Hash className="w-3 h-3 text-primary" />
              <span>{tag.name}</span>
              <span className="text-[10px] text-foreground-muted">
                ({tag.postCount})
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
