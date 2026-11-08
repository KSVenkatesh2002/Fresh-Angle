import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { Container } from "@/components/layout/Container";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { constructPageMetadata } from "@/lib/seo/metadata";
import { generateCollectionJsonLd } from "@/lib/seo/jsonld";
import { getCategoriesWithCounts } from "@/db/queries/categories";
import { getTagsWithCounts } from "@/db/queries/tags";
import { getArchiveMonths } from "@/db/queries/posts";
import { getDb } from "@/db/client";
import { posts } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import {
  Compass,
  FileText,
  FolderGit2,
  Tag,
  Calendar,
  Rss,
  ExternalLink,
  Shield,
  Layers,
  BookOpen,
} from "lucide-react";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return constructPageMetadata({
    title: "Sitemap Directory & Hub",
    description: `Complete architectural index and navigation directory of all publications, categories, tags, and archives on ${siteConfig.name}.`,
    path: "/sitemap",
  });
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function SitemapIndexPage(): Promise<React.JSX.Element> {
  const db = getDb();

  // Fetch all necessary grouped data in parallel
  const [categoriesList, tagsList, archiveMonths, recentPosts] = await Promise.all([
    getCategoriesWithCounts().catch(() => []),
    getTagsWithCounts().catch(() => []),
    getArchiveMonths().catch(() => []),
    db.query.posts
      .findMany({
        where: eq(posts.status, "published"),
        orderBy: [desc(posts.publishedAt)],
        limit: 50,
        columns: {
          id: true,
          title: true,
          slug: true,
          publishedAt: true,
        },
      })
      .catch(() => []),
  ]);

  const collectionJsonLd = generateCollectionJsonLd(
    "Sitemap Directory",
    `Complete directory and index of pages on ${siteConfig.name}.`,
    "/sitemap",
  );

  return (
    <main className="py-8 sm:py-12">
      <JsonLd data={collectionJsonLd} />
      <Container>
        <Breadcrumbs items={[{ name: "Sitemap", url: "/sitemap" }]} />

        {/* Header */}
        <div className="py-6 border-b border-border mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-primary mb-2 block">
                System Directory & Navigation
              </span>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground mb-3 flex items-center gap-3">
                <Compass className="w-8 h-8 text-primary" />
                Sitemap & Content Hub
              </h1>
              <p className="text-foreground-muted text-base max-w-2xl leading-relaxed">
                A structured directory of all content streams, research categories, topical tags,
                and publications across {siteConfig.name}.
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <Link
                href="/sitemap.xml"
                target="_blank"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold border border-border bg-surface hover:bg-surface-muted text-foreground transition-colors"
              >
                <Layers className="w-4 h-4 text-primary" />
                <span>Raw XML Sitemap</span>
                <ExternalLink className="w-3.5 h-3.5 text-foreground-muted" />
              </Link>
              <Link
                href="/rss"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold border border-border bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
              >
                <Rss className="w-4 h-4 text-primary" />
                <span>RSS Hub</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Quick Nav Anchors */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 text-xs font-medium text-foreground-muted no-scrollbar">
          <span className="text-foreground font-semibold uppercase tracking-wider whitespace-nowrap">
            Jump to:
          </span>
          <a
            href="#main-pages"
            className="px-3 py-1 rounded-full border border-border bg-surface hover:bg-surface-muted hover:text-foreground whitespace-nowrap transition-colors"
          >
            Core Pages
          </a>
          <a
            href="#categories"
            className="px-3 py-1 rounded-full border border-border bg-surface hover:bg-surface-muted hover:text-foreground whitespace-nowrap transition-colors"
          >
            Categories ({categoriesList.length})
          </a>
          <a
            href="#tags"
            className="px-3 py-1 rounded-full border border-border bg-surface hover:bg-surface-muted hover:text-foreground whitespace-nowrap transition-colors"
          >
            Tags ({tagsList.length})
          </a>
          <a
            href="#recent-posts"
            className="px-3 py-1 rounded-full border border-border bg-surface hover:bg-surface-muted hover:text-foreground whitespace-nowrap transition-colors"
          >
            Dispatches ({recentPosts.length})
          </a>
          <a
            href="#archives"
            className="px-3 py-1 rounded-full border border-border bg-surface hover:bg-surface-muted hover:text-foreground whitespace-nowrap transition-colors"
          >
            Archives
          </a>
          <a
            href="#legal"
            className="px-3 py-1 rounded-full border border-border bg-surface hover:bg-surface-muted hover:text-foreground whitespace-nowrap transition-colors"
          >
            Policies & Legal
          </a>
        </div>

        <div className="space-y-12">
          {/* Section 1: Core Pages */}
          <section id="main-pages" className="scroll-mt-24">
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Core Navigation
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[
                { title: "Home", href: "/", desc: "Latest technical briefings and featured insights" },
                { title: "All Dispatches", href: "/blog", desc: "Chronological feed of all articles" },
                { title: "Categories Directory", href: "/categories", desc: "Browse by technical track" },
                { title: "Tags Index", href: "/tags", desc: "Browse by topical keywords" },
                { title: "Archive by Month", href: "/archive", desc: "Historical monthly dispatches" },
                { title: "Semantic Search", href: "/search", desc: "Query briefings and articles" },
                { title: "About Editorial", href: "/about", desc: "Mission, methodology, and AI engine" },
                { title: "Contact Team", href: "/contact", desc: "Inquiries, corrections, and feedback" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="p-4 rounded-xl border border-border bg-surface hover:bg-surface-muted transition-colors group block"
                >
                  <span className="font-semibold text-foreground group-hover:text-primary transition-colors block mb-1">
                    {item.title}
                  </span>
                  <span className="text-xs text-foreground-muted line-clamp-2">
                    {item.desc}
                  </span>
                </Link>
              ))}
            </div>
          </section>

          {/* Section 2: Categories */}
          <section id="categories" className="scroll-mt-24">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <FolderGit2 className="w-5 h-5 text-primary" />
                Research Categories & Tracks
              </h2>
              <Link
                href="/categories"
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              >
                View all categories &rarr;
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {categoriesList.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/category/${cat.slug}`}
                  className="p-4 rounded-xl border border-border bg-surface hover:bg-surface-muted transition-colors group flex items-center justify-between"
                >
                  <div>
                    <span className="font-semibold text-foreground group-hover:text-primary transition-colors block text-sm">
                      {cat.name}
                    </span>
                    <span className="text-xs text-foreground-muted">
                      {cat.postCount} {cat.postCount === 1 ? "article" : "articles"}
                    </span>
                  </div>
                  <FolderGit2 className="w-4 h-4 text-foreground-muted group-hover:text-primary transition-colors" />
                </Link>
              ))}
            </div>
          </section>

          {/* Section 3: Tags Cloud */}
          <section id="tags" className="scroll-mt-24">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Tag className="w-5 h-5 text-primary" />
                Topical Tags & Entities
              </h2>
              <Link
                href="/tags"
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              >
                View all tags &rarr;
              </Link>
            </div>
            <div className="flex flex-wrap gap-2">
              {tagsList.slice(0, 40).map((tag) => (
                <Link
                  key={tag.id}
                  href={`/tag/${tag.slug}`}
                  className="px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-muted text-xs font-medium text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                >
                  <span>#{tag.name}</span>
                  <span className="text-[10px] text-foreground-muted bg-surface-muted px-1.5 py-0.5 rounded">
                    {tag.postCount}
                  </span>
                </Link>
              ))}
            </div>
          </section>

          {/* Section 4: Recent Dispatches */}
          <section id="recent-posts" className="scroll-mt-24">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                Recent Dispatches
              </h2>
              <Link
                href="/blog"
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              >
                Browse all in Blog &rarr;
              </Link>
            </div>
            <div className="rounded-xl border border-border bg-surface divide-y divide-border overflow-hidden">
              {recentPosts.map((post) => {
                const dateStr = post.publishedAt
                  ? new Date(post.publishedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : null;

                return (
                  <Link
                    key={post.id}
                    href={`/blog/${post.slug}`}
                    className="p-3.5 sm:px-5 sm:py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 hover:bg-surface-muted transition-colors group"
                  >
                    <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                      {post.title}
                    </span>
                    {dateStr && (
                      <span className="text-xs text-foreground-muted shrink-0 font-mono">
                        {dateStr}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Section 5: Archives */}
          <section id="archives" className="scroll-mt-24">
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Chronological Archives
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {archiveMonths.map((m) => {
                const monthName = MONTH_NAMES[m.month - 1] || `Month ${m.month}`;
                const monthPad = String(m.month).padStart(2, "0");
                return (
                  <Link
                    key={`${m.year}-${m.month}`}
                    href={`/archive/${m.year}/${monthPad}`}
                    className="p-3 rounded-xl border border-border bg-surface hover:bg-surface-muted text-center transition-colors group"
                  >
                    <span className="block text-sm font-semibold text-foreground group-hover:text-primary">
                      {monthName} {m.year}
                    </span>
                    <span className="text-xs text-foreground-muted">
                      {m.count} {m.count === 1 ? "post" : "posts"}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Section 6: Legal & Disclosures */}
          <section id="legal" className="scroll-mt-24 pt-4 border-t border-border">
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Editorial Transparency & Legal
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { title: "Editorial Policy", href: "/editorial-policy", desc: "Peer-review standards and correction workflow" },
                { title: "Privacy Policy", href: "/privacy-policy", desc: "Data protection and cookie policies" },
                { title: "Terms of Service", href: "/terms", desc: "Usage terms, copyright, and disclaimers" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="p-4 rounded-xl border border-border bg-surface hover:bg-surface-muted transition-colors group block"
                >
                  <span className="font-semibold text-foreground group-hover:text-primary transition-colors block mb-1 text-sm">
                    {item.title}
                  </span>
                  <span className="text-xs text-foreground-muted">
                    {item.desc}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </Container>
    </main>
  );
}

