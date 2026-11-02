import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
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
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPostsByCategory(slug, { page: 1, limit: 1 });

  if (!result.category) {
    return { title: 'Category Not Found' };
  }

  return constructPageMetadata({
    title: `${result.category.name} - Technical Track`,
    description: result.category.description || `Browse articles in ${result.category.name} on ${siteConfig.name}.`,
    path: `/category/${slug}`,
  });
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}): Promise<React.JSX.Element> {
  const { slug } = await params;
  const sParams = await searchParams;
  const currentPage = parseInt(sParams.page || '1', 10) || 1;

  const result = await getPostsByCategory(slug, {
    page: currentPage,
    limit: siteConfig.postsPerPage,
  });

  if (!result.category) {
    notFound();
  }

  return (
    <main className="py-8 sm:py-12">
      <Container>
        <Breadcrumbs
          items={[
            { name: 'Blog', url: '/blog' },
            { name: result.category.name, url: `/category/${slug}` },
          ]}
        />

        <div className="py-6 border-b border-border mb-8 space-y-4">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary block">
            Technical Track Hub
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            {result.category.name}
          </h1>
          {result.category.description && (
            <p className="text-foreground-muted text-base max-w-2xl leading-relaxed">
              {result.category.description}
            </p>
          )}
          {result.category.introText && (
            <div className="p-4 rounded-xl bg-surface border border-border text-sm text-foreground-muted leading-relaxed">
              {result.category.introText}
            </div>
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
