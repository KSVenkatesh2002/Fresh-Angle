import { describe, it, expect } from "vitest";
import { getPaginationUrl } from "@/components/ui/Pagination";

function calculatePaginationPages(
  currentPage: number,
  totalPages: number,
  maxVisible = 5,
): number[] {
  if (totalPages <= 1) return [];

  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  const endPage = Math.min(totalPages, startPage + maxVisible - 1);

  if (endPage - startPage + 1 < maxVisible) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  const pages: number[] = [];
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }
  return pages;
}

describe("Pagination Logic", () => {
  it("returns empty array if total pages is 1 or less", () => {
    expect(calculatePaginationPages(1, 1)).toEqual([]);
    expect(calculatePaginationPages(1, 0)).toEqual([]);
  });

  it("centers current page within visible window", () => {
    expect(calculatePaginationPages(5, 10, 5)).toEqual([3, 4, 5, 6, 7]);
    expect(calculatePaginationPages(1, 10, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(calculatePaginationPages(10, 10, 5)).toEqual([6, 7, 8, 9, 10]);
  });

  it("generates path-based URL with clean root for page 1", () => {
    expect(getPaginationUrl({ basePath: "/blog", page: 1 })).toBe("/blog");
    expect(getPaginationUrl({ basePath: "/category/technology", page: 1 })).toBe(
      "/category/technology",
    );
    expect(getPaginationUrl({ basePath: "/blog", page: 2 })).toBe("/blog/page/2");
    expect(getPaginationUrl({ basePath: "/category/ai/", page: 3 })).toBe("/category/ai/page/3");
  });

  it("safely strips existing /page/n suffix in path mode to prevent repeated concatenation", () => {
    expect(getPaginationUrl({ basePath: "/blog/page/2", page: 3 })).toBe("/blog/page/3");
    expect(getPaginationUrl({ basePath: "/archive/2026/11/page/2", page: 1 })).toBe(
      "/archive/2026/11",
    );
  });

  it("generates query-based URLs for search and queries", () => {
    expect(
      getPaginationUrl({
        basePath: "/search?q=transformers&sort=newest",
        page: 2,
        mode: "query",
      }),
    ).toBe("/search?q=transformers&sort=newest&page=2");

    expect(
      getPaginationUrl({
        basePath: "/search?q=transformers&sort=newest&page=2",
        page: 1,
        mode: "query",
      }),
    ).toBe("/search?q=transformers&sort=newest");
  });

  it("repairs and sanitizes polluted search URLs containing repeated /page/5", () => {
    // The exact bug from the user screenshot: /search?q=&category=&sort=newest/page/5/page/5/page/5
    const pollutedUrl = "/search?q=&category=&sort=newest/page/5/page/5/page/5";
    const resultPage2 = getPaginationUrl({
      basePath: pollutedUrl,
      page: 2,
      mode: "query",
    });

    expect(resultPage2).not.toContain("/page/5");
    expect(resultPage2).toBe("/search?q=&category=&sort=newest&page=2");

    const resultPage1 = getPaginationUrl({
      basePath: pollutedUrl,
      page: 1,
      mode: "query",
    });
    expect(resultPage1).toBe("/search?q=&category=&sort=newest");
  });

  it("handles query mode on bare /search without query string", () => {
    expect(getPaginationUrl({ basePath: "/search", page: 2, mode: "query" })).toBe(
      "/search?page=2",
    );
    expect(getPaginationUrl({ basePath: "/search", page: 1, mode: "query" })).toBe("/search");
  });
});
