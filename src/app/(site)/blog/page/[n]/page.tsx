import React from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getPublishedPosts, PaginatedPostsResult } from '@/db/queries/posts';
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
  params: Promise<{ n: string }>;
}): Promise<Metadata> {
  const { n } = await params;
  const pageNumber = parseInt(n, 10) || 1;

  return constructPageMetadata({
    title: `All Dispatches - Page ${pageNumber}`,
    description: `Browse page ${pageNumber} of analytical briefings on artificial intelligence by ${siteConfig.name}.`,
    path: `/blog/page/${pageNumber}`,
  });
}

export default async function BlogPaginatedPage({
  params,
}: {
  params: Promise<{ n: string }>;
}): Promise<React.JSX.Element> {
  const { n } = await params;
  const pageNumber = parseInt(n, 10);

  if (!pageNumber || pageNumber <= 1) {
    redirect('/blog');
  }

  const limit = siteConfig.postsPerPage;
  let postsData: PaginatedPostsResult = {
    posts: [],
    total: 0,
    page: pageNumber,
    limit,
    totalPages: 1,
  };


  try {
    postsData = await getPublishedPosts({ page: pageNumber, limit });
  } catch (err) {
    console.warn(`⚠️ [BlogPage] Error loading posts: ${(err as Error).message}`);
  }

  if (pageNumber > postsData.totalPages && postsData.totalPages > 0) {
    redirect('/blog');
  }

  return (
    <main className="py-8 sm:py-12">
      <Container>
        <Breadcrumbs
          items={[
            { name: 'Blog', url: '/blog' },
            { name: `Page ${pageNumber}`, url: `/blog/page/${pageNumber}` },
          ]}
        />

        <div className="py-6 border-b border-border mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground mb-3">
            All Technical Dispatches (Page {pageNumber})
          </h1>
          <p className="text-foreground-muted text-base max-w-2xl leading-relaxed">
            In-depth daily analyses synthesized from primary research papers, hardware disclosures, and engineering announcements.
          </p>
        </div>

        <PostList posts={postsData.posts} />

        <Pagination
          currentPage={postsData.page}
          totalPages={postsData.totalPages}
          basePath="/blog"
        />
      </Container>
    </main>
  );
}
