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
import {
  Rss,
  FolderGit2,
  ExternalLink,
  Radio,
  CheckCircle2,
} from "lucide-react";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return constructPageMetadata({
    title: "RSS & Syndication Feeds Hub",
    description: `Subscribe to real-time AI and technology dispatches via RSS. Global feed and category-specific syndication feeds on ${siteConfig.name}.`,
    path: "/rss",
  });
}

export default async function RssHubPage(): Promise<React.JSX.Element> {
  const categoriesList = await getCategoriesWithCounts().catch(() => []);

  const collectionJsonLd = generateCollectionJsonLd(
    "RSS Syndication Hub",
    `RSS and Atom feeds directory for ${siteConfig.name}.`,
    "/rss",
  );

  return (
    <main className="py-8 sm:py-12">
      <JsonLd data={collectionJsonLd} />
      <Container>
        <Breadcrumbs items={[{ name: "RSS Feeds", url: "/rss" }]} />

        {/* Header */}
        <div className="py-6 border-b border-border mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-primary mb-2 block">
                Syndication & Reader Access
              </span>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground mb-3 flex items-center gap-3">
                <Rss className="w-8 h-8 text-primary" />
                RSS Feeds & Syndication Hub
              </h1>
              <p className="text-foreground-muted text-base max-w-2xl leading-relaxed">
                Stay updated with autonomous briefings, papers, and breaking analysis. Connect
                to your favorite RSS reader (Feedly, Inoreader, NewsBlur, NetNewsWire, etc.).
              </p>
            </div>

            <Link
              href="/sitemap"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold border border-border bg-surface hover:bg-surface-muted text-foreground transition-colors"
            >
              <span>Explore Sitemap Directory</span>
              <ExternalLink className="w-3.5 h-3.5 text-foreground-muted" />
            </Link>
          </div>
        </div>

        {/* Primary Global Feed Banner */}
        <div className="p-6 rounded-2xl border border-primary/30 bg-primary/5 mb-10 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start sm:items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shrink-0 shadow">
                <Radio className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg font-bold text-foreground">
                    Master Technical Feed (All Dispatches)
                  </h2>
                  <span className="text-[10px] font-semibold uppercase tracking-wider bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                    Recommended
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-foreground-muted">
                  Includes every newly verified technical paper review, model release briefing, and industry dispatch.
                </p>
                <code className="text-xs font-mono text-primary mt-2 block break-all">
                  {siteConfig.url}/feed.xml
                </code>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/feed.xml"
                target="_blank"
                rel="alternate"
                type="application/rss+xml"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
              >
                <Rss className="w-4 h-4" />
                <span>Open XML Feed</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Sub-Feeds by Track / Category */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <FolderGit2 className="w-5 h-5 text-primary" />
                Category-Specific Feeds
              </h2>
              <p className="text-xs sm:text-sm text-foreground-muted mt-0.5">
                Only subscribe to the specialized topics you follow closely.
              </p>
            </div>
            <span className="text-xs text-foreground-muted font-medium">
              {categoriesList.length} Tracks
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categoriesList.map((cat) => {
              const catFeedUrl = `/feed/category/${cat.slug}.xml`;
              return (
                <div
                  key={cat.id}
                  className="p-5 rounded-xl border border-border bg-surface hover:border-border-muted transition-colors flex flex-col justify-between"
                >
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <Link
                        href={`/category/${cat.slug}`}
                        className="font-bold text-base text-foreground hover:text-primary transition-colors"
                      >
                        {cat.name}
                      </Link>
                      <span className="text-xs font-mono text-foreground-muted bg-surface-muted px-2 py-0.5 rounded-full border border-border">
                        {cat.postCount} {cat.postCount === 1 ? "post" : "posts"}
                      </span>
                    </div>
                    {cat.description && (
                      <p className="text-xs text-foreground-muted line-clamp-2">
                        {cat.description}
                      </p>
                    )}
                    <code className="text-[11px] font-mono text-foreground-muted block mt-2 truncate">
                      {siteConfig.url}{catFeedUrl}
                    </code>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <Link
                      href={`/category/${cat.slug}`}
                      className="text-xs font-semibold text-foreground-muted hover:text-foreground transition-colors"
                    >
                      Browse Articles &rarr;
                    </Link>
                    <Link
                      href={catFeedUrl}
                      target="_blank"
                      rel="alternate"
                      type="application/rss+xml"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
                    >
                      <Rss className="w-3.5 h-3.5" />
                      <span>Subscribe Feed</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Reader Instructions */}
        <div className="mt-12 p-6 rounded-2xl border border-border bg-surface">
          <h3 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            How to Use These Feeds in Your RSS Reader
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-xs sm:text-sm text-foreground-muted leading-relaxed">
            <li>
              Copy either the Master Feed URL (<code>{siteConfig.url}/feed.xml</code>) or any category feed above.
            </li>
            <li>
              Open your RSS feed client (Feedly, Inoreader, Apple Podcasts/News, NetNewsWire, Miniflux, etc.).
            </li>
            <li>
              Click &quot;Add Content&quot; or &quot;Subscribe to Feed&quot; and paste the URL.
            </li>
            <li>
              You will automatically receive new briefings the moment they pass automated fact-verification.
            </li>
          </ol>
        </div>
      </Container>
    </main>
  );
}
