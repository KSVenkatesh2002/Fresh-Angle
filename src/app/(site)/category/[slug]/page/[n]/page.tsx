import React from 'react';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getPostsByCategory } from '@/db/queries/posts';
import { Container } from '@/components/layout/Container';
import { PostList } from '@/components/blog/PostList';
import { Pagination } from '@/components/ui/Pagination';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';
import { constructPageMetadata } from '@/lib/seo/metadata';
import { siteConfig } from '@/config/site';

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; n: string }>;
}): Promise<Metadata> {
  const { slug, n } = await params;
  const pageNumber = parseInt(n, 10) || 1;
  const result = await getPostsByCategory(slug, { page: 1, limit: 1 });

  if (!result.category) {
    return { title: 'Category Not Found' };
  }

  return constructPageMetadata({
    title: `${result.category.name} - Page ${pageNumber}`,
    description: `Browse page ${pageNumber} of articles in ${result.category.name} on ${siteConfig.name}.`,
    path: `/category/${slug}/page/${pageNumber}`,
  });
}

export default async function CategoryPaginatedPage({
  params,
}: {
  params: Promise<{ slug: string; n: string }>;
}): Promise<React.JSX.Element> {
  const { slug, n } = await params;
  const pageNumber = parseInt(n, 10);

  if (!pageNumber || pageNumber <= 1) {
    redirect(`/category/${slug}`);
  }

  const result = await getPostsByCategory(slug, {
    page: pageNumber,
    limit: siteConfig.postsPerPage,
  });

  if (!result.category) {
    notFound();
  }

  if (pageNumber > result.totalPages && result.totalPages > 0) {
    redirect(`/category/${slug}`);
  }

  return (
    <main className="py-8 sm:py-12">
      <Container>
        <Breadcrumbs
          items={[
            { name: 'Blog', url: '/blog' },
            { name: result.category.name, url: `/category/${slug}` },
            { name: `Page ${pageNumber}`, url: `/category/${slug}/page/${pageNumber}` },
          ]}
        />

        <div className="py-6 border-b border-border mb-8">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary mb-2 block">
            Technical Track
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground mb-3">
            {result.category.name} (Page {pageNumber})
          </h1>
          {result.category.description && (
            <p className="text-foreground-muted text-base max-w-2xl leading-relaxed">
              {result.category.description}
            </p>
          )}
        </div>

        <PostList
          posts={result.posts}
          emptyMessage={`No published dispatches under "${result.category.name}" yet.`}
        />

        <Pagination
          currentPage={result.page}
          totalPages={result.totalPages}
          basePath={`/category/${slug}`}
        />
      </Container>
    </main>
  );
}
