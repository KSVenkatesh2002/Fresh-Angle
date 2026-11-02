import React from 'react';
import type { Metadata } from 'next';
import Form from 'next/form';
import { searchPosts } from '@/db/queries/posts';
import { Container } from '@/components/layout/Container';
import { PostList } from '@/components/blog/PostList';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';
import { constructPageMetadata } from '@/lib/seo/metadata';
import { Search as SearchIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}): Promise<Metadata> {
  const { q } = await searchParams;
  const title = q ? `Search results for "${q}"` : 'Search Articles';

  return constructPageMetadata({
    title,
    description: 'Search technical articles, benchmarks, and AI briefings on Fresh Angle.',
    path: '/search',
    noIndex: true, // SEO rule: noindex on search pages to prevent thin duplicate content
  });
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}): Promise<React.JSX.Element> {
  const { q } = await searchParams;
  const query = q?.trim() || '';

  let results: Awaited<ReturnType<typeof searchPosts>> = [];
  if (query.length > 0) {
    try {
      results = await searchPosts(query, 24);
    } catch (err) {
      console.warn(`⚠️ [Search] DB search error: ${(err as Error).message}`);
    }
  }

  return (
    <main className="py-8 sm:py-12">
      <Container size="narrow">
        <Breadcrumbs items={[{ name: 'Search', url: '/search' }]} />

        <div className="py-6 border-b border-border mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground mb-3">
            Search Technical Dispatches
          </h1>
          <p className="text-foreground-muted text-base">
            Search by model name, architecture, benchmark, company, or keyword.
          </p>

          <Form action="/search" className="mt-6 flex gap-2">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="e.g. Claude 3.7, DeepSeek R1, Transformers, GPUs..."
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-surface text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-sm"
                required
              />
            </div>
            <Button type="submit" variant="primary" className="px-6">
              Search
            </Button>
          </Form>
        </div>

        {query.length > 0 && (
          <div className="mb-6 flex items-center justify-between text-sm text-foreground-muted">
            <p>
              Found <strong className="text-foreground">{results.length}</strong> result{results.length === 1 ? '' : 's'} for &ldquo;{query}&rdquo;
            </p>
          </div>
        )}

        <PostList
          posts={results}
          emptyMessage={
            query.length > 0
              ? `No articles found matching "${query}". Try searching for broader terms like "LLM", "Models", or "Architecture".`
              : 'Enter a search term above to explore articles across our archive.'
          }
        />
      </Container>
    </main>
  );
}
