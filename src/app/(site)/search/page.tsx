import React from 'react';
import type { Metadata } from 'next';
import { advancedSearchPosts } from '@/db/queries/posts';
import { getAllCategories } from '@/db/queries/categories';
import { Container } from '@/components/layout/Container';
import { PostList } from '@/components/blog/PostList';
import { Pagination } from '@/components/ui/Pagination';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';
import { constructPageMetadata } from '@/lib/seo/metadata';
import { Search as SearchIcon, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}): Promise<Metadata> {
  const { q } = await searchParams;
  const title = q ? `Search results for "${q}"` : 'Search Technical Dispatches';

  return constructPageMetadata({
    title,
    description: 'Search technical articles, benchmarks, and AI briefings on Fresh Angle.',
    path: '/search',
    noIndex: true, // SEO rule: search pages are noindex to prevent duplicate search content
  });
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    sort?: 'relevance' | 'newest' | 'oldest';
    page?: string;
  }>;
}): Promise<React.JSX.Element> {
  const params = await searchParams;
  const query = params.q?.trim() || '';
  const selectedCategory = params.category || '';
  const selectedSort = params.sort || (query ? 'relevance' : 'newest');
  const currentPage = parseInt(params.page || '1', 10) || 1;

  const [categoriesList, searchResult] = await Promise.all([
    getAllCategories().catch(() => []),
    advancedSearchPosts({
      query,
      category: selectedCategory || undefined,
      sort: selectedSort,
      page: currentPage,
      limit: 12,
    }).catch(() => ({ posts: [], total: 0, page: 1, limit: 12, totalPages: 1 })),
  ]);

  return (
    <main className="py-8 sm:py-12">
      <Container size="narrow">
        <Breadcrumbs items={[{ name: 'Search', url: '/search' }]} />

        <div className="py-6 border-b border-border mb-8 space-y-4">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Search Technical Dispatches
          </h1>
          <p className="text-foreground-muted text-base">
            Search by model name, architecture, benchmark, company, or technical entity.
          </p>

          <form action="/search" method="GET" className="space-y-3 pt-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
                <input
                  type="search"
                  name="q"
                  defaultValue={query}
                  placeholder="e.g. Claude 3.7, DeepSeek R1, Transformers, GPUs..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-surface text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                />
              </div>
              <Button type="submit" variant="primary" className="px-6">
                Search
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-foreground-muted">
              <span className="flex items-center gap-1 font-medium text-foreground">
                <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
                Filters:
              </span>
              <select
                name="category"
                defaultValue={selectedCategory}
                aria-label="Filter by track"
                className="px-2.5 py-1.5 rounded-lg border border-border bg-surface text-foreground focus:outline-none focus:ring-1 focus:ring-ring text-xs"
              >
                <option value="">All Tracks</option>
                {categoriesList.map((c) => (
                  <option key={c.id} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                name="sort"
                defaultValue={selectedSort}
                aria-label="Sort dispatches"
                className="px-2.5 py-1.5 rounded-lg border border-border bg-surface text-foreground focus:outline-none focus:ring-1 focus:ring-ring text-xs"
              >
                <option value="relevance">Relevance</option>
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>
          </form>
        </div>

        {query.length > 0 && (
          <div className="mb-6 flex items-center justify-between text-sm text-foreground-muted">
            <p>
              Found <strong className="text-foreground">{searchResult.total}</strong> result
              {searchResult.total === 1 ? '' : 's'}
              {query ? ` for "${query}"` : ''}
            </p>
          </div>
        )}

        <PostList
          posts={searchResult.posts}
          emptyMessage={
            query.length > 0
              ? `No articles found matching "${query}". Try searching for broader terms like "LLM", "Silicon", or "Architecture".`
              : 'Enter a search query or filter by track above to explore our archive.'
          }
        />

        {searchResult.totalPages > 1 && (
          <Pagination
            currentPage={searchResult.page}
            totalPages={searchResult.totalPages}
            basePath={`/search?q=${encodeURIComponent(query)}&category=${encodeURIComponent(selectedCategory)}&sort=${selectedSort}`}
          />
        )}
      </Container>
    </main>
  );
}
