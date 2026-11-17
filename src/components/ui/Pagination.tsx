import React from "react";
import Link from "next/link";

export interface PaginationUrlOptions {
  basePath: string;
  page: number;
  mode?: "path" | "query";
  queryParam?: string;
}

export function getPaginationUrl({
  basePath,
  page,
  mode,
  queryParam = "page",
}: PaginationUrlOptions): string {
  const isQueryMode = mode === "query" || basePath.includes("?");

  if (isQueryMode) {
    const [rawPath, rawSearch] = basePath.split("?");
    const cleanPath = rawPath.replace(/\/page\/\d+.*$/, "").replace(/\/$/, "");
    const searchParams = new URLSearchParams(rawSearch || "");

    // Strip any polluted /page/ from existing query parameters
    for (const [key, value] of Array.from(searchParams.entries())) {
      if (value.includes("/page/")) {
        searchParams.set(key, value.replace(/\/page\/\d+.*$/, ""));
      }
    }

    if (page === 1) {
      searchParams.delete(queryParam);
    } else {
      searchParams.set(queryParam, String(page));
    }

    const queryString = searchParams.toString();
    const resolvedPath = cleanPath || "/";
    return queryString ? `${resolvedPath}?${queryString}` : resolvedPath;
  }

  // Path-based pagination: e.g. /blog -> /blog/page/2
  const cleanBase = basePath.replace(/\/page\/\d+.*$/, "").replace(/\/$/, "");
  return page === 1 ? cleanBase || "/" : `${cleanBase}/page/${page}`;
}

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  basePath: string;
  mode?: "path" | "query";
  queryParam?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  basePath,
  mode,
  queryParam = "page",
}: PaginationProps): React.JSX.Element | null {
  if (totalPages <= 1) return null;

  const getPageUrl = (page: number): string =>
    getPaginationUrl({ basePath, page, mode, queryParam });

  const pages: number[] = [];
  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <nav
      role="navigation"
      aria-label="Pagination Navigation"
      className="flex items-center justify-center gap-1.5 my-10"
    >
      {currentPage > 1 ? (
        <Link
          href={getPageUrl(currentPage - 1)}
          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-border bg-surface text-foreground hover:bg-surface-muted transition-colors"
          aria-label="Go to previous page"
        >
          Previous
        </Link>
      ) : (
        <span
          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-border bg-surface-muted text-foreground-muted opacity-50 cursor-not-allowed"
          aria-disabled="true"
        >
          Previous
        </span>
      )}

      {pages.map((p) => {
        const isCurrent = p === currentPage;
        return (
          <Link
            key={p}
            href={getPageUrl(p)}
            className={`min-w-9 h-9 flex items-center justify-center px-3 text-sm font-medium rounded-lg transition-colors ${
              isCurrent
                ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                : "bg-surface border border-border text-foreground hover:bg-surface-muted"
            }`}
            aria-current={isCurrent ? "page" : undefined}
          >
            {p}
          </Link>
        );
      })}

      {currentPage < totalPages ? (
        <Link
          href={getPageUrl(currentPage + 1)}
          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-border bg-surface text-foreground hover:bg-surface-muted transition-colors"
          aria-label="Go to next page"
        >
          Next
        </Link>
      ) : (
        <span
          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-border bg-surface-muted text-foreground-muted opacity-50 cursor-not-allowed"
          aria-disabled="true"
        >
          Next
        </span>
      )}
    </nav>
  );
}
