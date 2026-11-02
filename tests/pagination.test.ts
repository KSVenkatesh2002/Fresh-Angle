import { describe, it, expect } from "vitest";

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

function getPaginationUrl(basePath: string, page: number): string {
  const cleanBase = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
  return page === 1 ? cleanBase || "/" : `${cleanBase}/page/${page}`;
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
    expect(getPaginationUrl("/blog", 1)).toBe("/blog");
    expect(getPaginationUrl("/category/technology", 1)).toBe(
      "/category/technology",
    );
    expect(getPaginationUrl("/blog", 2)).toBe("/blog/page/2");
    expect(getPaginationUrl("/category/ai/", 3)).toBe("/category/ai/page/3");
  });
});
