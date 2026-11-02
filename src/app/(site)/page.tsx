import React from 'react';
import Link from 'next/link';
import { getPublishedPosts } from '@/db/queries/posts';
import { getAllCategories } from '@/db/queries/categories';
import { Container } from '@/components/layout/Container';
import { PostCard } from '@/components/blog/PostCard';
import { PostList } from '@/components/blog/PostList';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Sparkles, ArrowRight, Rss, Layers } from 'lucide-react';
import { siteConfig } from '@/config/site';

export const revalidate = 3600; // 1 hour ISR

export default async function HomePage(): Promise<React.JSX.Element> {
  let initialPosts: Awaited<ReturnType<typeof getPublishedPosts>>['posts'] = [];
  let categories: Awaited<ReturnType<typeof getAllCategories>> = [];

  try {
    const [postsData, categoriesData] = await Promise.all([
      getPublishedPosts({ page: 1, limit: 10 }),
      getAllCategories(),
    ]);
    initialPosts = postsData.posts;
    categories = categoriesData;
  } catch (err) {
    console.warn(`⚠️ [HomePage] DB not connected or empty: ${(err as Error).message}`);
  }

  const featuredPost = initialPosts[0];
  const regularPosts = initialPosts.slice(1);

  return (
    <main className="py-8 sm:py-12 space-y-12 sm:space-y-16">
      <Container>
        {/* Hero Section */}
        <div className="relative py-12 sm:py-16 px-6 sm:px-12 rounded-3xl bg-surface border border-border shadow-sm overflow-hidden mb-12">
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-96 h-96 rounded-full bg-accent/10 blur-3xl pointer-events-none" />

          <div className="relative max-w-3xl space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-muted border border-border text-xs font-medium text-primary">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Autonomous AI & Technology Editorial</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground leading-[1.15]">
              {siteConfig.tagline}
            </h1>

            <p className="text-foreground-muted text-base sm:text-lg leading-relaxed">
              Every day at midnight UTC, our autonomous research engine scans primary sources, analyzes model releases, and synthesizes verifiable technical briefings for software engineers and technology leaders.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link href="/blog">
                <Button variant="primary" size="md" className="gap-2">
                  <span>Explore All Dispatches</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/feed.xml" target="_blank" rel="alternate" type="application/rss+xml">
                <Button variant="outline" size="md" className="gap-2">
                  <Rss className="w-4 h-4 text-warning" />
                  <span>RSS Subscription</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Featured Post (if available) */}
        {featuredPost && (
          <section aria-labelledby="featured-dispatch-heading" className="mb-12 sm:mb-16">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <h2 id="featured-dispatch-heading" className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  Today&apos;s Featured Briefing
                </h2>
              </div>
              <Badge variant="primary">Latest Release</Badge>
            </div>
            <PostCard post={featuredPost} featured />
          </section>
        )}

        {/* Categories Bar */}
        {categories.length > 0 && (
          <div className="my-8 py-4 border-y border-border">
            <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wider text-foreground-muted">
              <Layers className="w-3.5 h-3.5" />
              <span>Browse by Technical Track</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <Link key={cat.id} href={`/category/${cat.slug}`}>
                  <Badge variant="outline" className="hover:border-primary hover:text-primary transition-colors py-1 px-3 text-xs cursor-pointer">
                    {cat.name}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Recent Dispatches Grid */}
        <section aria-labelledby="recent-dispatches-heading">
          <div className="flex items-center justify-between mb-6">
            <h2 id="recent-dispatches-heading" className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Recent Dispatches
            </h2>
            <Link
              href="/blog"
              className="text-sm font-medium text-primary hover:underline underline-offset-4 flex items-center gap-1"
            >
              <span>View archive</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <PostList
            posts={regularPosts}
            emptyMessage="The research engine is currently preparing tomorrow's briefing. Check back shortly!"
          />
        </section>
      </Container>
    </main>
  );
}
