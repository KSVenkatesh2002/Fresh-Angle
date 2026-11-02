import React from "react";
import type { Metadata } from "next";
import { getPublishedPosts } from "@/db/queries/posts";
import { Container } from "@/components/layout/Container";
import { PostList } from "@/components/blog/PostList";
import { Pagination } from "@/components/ui/Pagination";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { constructPageMetadata } from "@/lib/seo/metadata";
import { siteConfig } from "@/config/site";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return constructPageMetadata({
    title: "Archive of AI & Tech Dispatches",
    description: `Browse all analytical briefings on artificial intelligence and technology by ${siteConfig.name}.`,
    path: "/blog",
  });
}

export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}): Promise<React.JSX.Element> {
  const params = await searchParams;
  const currentPage = parseInt(params.page || "1", 10) || 1;
  const limit = siteConfig.postsPerPage;

  let postsData: Awaited<ReturnType<typeof getPublishedPosts>> = {
    posts: [],
    total: 0,
    page: currentPage,
    limit,
    totalPages: 1,
  };

  try {
    postsData = await getPublishedPosts({ page: currentPage, limit });
  } catch (err) {
    console.warn(
      `⚠️ [BlogPage] Error loading posts: ${(err as Error).message}`,
    );
  }

  return (
    <main className="py-8 sm:py-12">
      <Container>
        <Breadcrumbs items={[{ name: "Blog", url: "/blog" }]} />

        <div className="py-6 border-b border-border mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground mb-3">
            All Technical Dispatches
          </h1>
          <p className="text-foreground-muted text-base max-w-2xl leading-relaxed">
            In-depth daily analyses synthesized from primary research papers,
            hardware disclosures, and engineering announcements.
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
