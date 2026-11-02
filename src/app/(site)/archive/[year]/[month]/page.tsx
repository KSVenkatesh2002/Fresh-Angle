import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPostsByArchive } from "@/db/queries/posts";
import { Container } from "@/components/layout/Container";
import { PostList } from "@/components/blog/PostList";
import { Pagination } from "@/components/ui/Pagination";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { constructPageMetadata } from "@/lib/seo/metadata";
import { siteConfig } from "@/config/site";

export const revalidate = 3600;
export const dynamicParams = true;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ year: string; month: string }>;
}): Promise<Metadata> {
  const { year, month } = await params;
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const monthName = MONTH_NAMES[m - 1] || month;

  return constructPageMetadata({
    title: `Archive: ${monthName} ${y}`,
    description: `Browse all artificial intelligence dispatches published in ${monthName} ${y} on ${siteConfig.name}.`,
    path: `/archive/${year}/${month}`,
  });
}

export default async function ArchiveMonthPage({
  params,
  searchParams,
}: {
  params: Promise<{ year: string; month: string }>;
  searchParams: Promise<{ page?: string }>;
}): Promise<React.JSX.Element> {
  const { year, month } = await params;
  const sParams = await searchParams;
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);

  if (isNaN(y) || isNaN(m) || m < 1 || m > 12) {
    notFound();
  }

  const currentPage = parseInt(sParams.page || "1", 10) || 1;
  const result = await getPostsByArchive(y, m, {
    page: currentPage,
    limit: siteConfig.postsPerPage,
  });

  const monthName = MONTH_NAMES[m - 1];

  return (
    <main className="py-8 sm:py-12">
      <Container>
        <Breadcrumbs
          items={[
            { name: "Archive", url: "/archive" },
            { name: `${monthName} ${y}`, url: `/archive/${year}/${month}` },
          ]}
        />

        <div className="py-6 border-b border-border mb-8">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary mb-2 block">
            Archive Period
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground mb-3">
            {monthName} {y} Dispatches
          </h1>
          <p className="text-foreground-muted text-base max-w-2xl">
            {result.total} {result.total === 1 ? "dispatch" : "dispatches"}{" "}
            published during {monthName} {y}.
          </p>
        </div>

        <PostList
          posts={result.posts}
          emptyMessage={`No dispatches found for ${monthName} ${y}.`}
        />

        <Pagination
          currentPage={result.page}
          totalPages={result.totalPages}
          basePath={`/archive/${year}/${month}`}
        />
      </Container>
    </main>
  );
}
