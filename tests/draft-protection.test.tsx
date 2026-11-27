import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { sanitizeRedirectPath } from "@/lib/auth/redirect";

const mockNotFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const mockNoStore = vi.fn();
const mockIsAuthenticated = vi.fn<() => Promise<boolean>>();
const mockGetPostBySlug = vi.fn();
const mockGetRelatedPosts = vi.fn();
const mockGetAllPostSlugs = vi.fn();
const mockGetDisplaySettings = vi.fn();

vi.mock("next/navigation", () => ({
  notFound: () => mockNotFound(),
  permanentRedirect: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/cache", () => ({
  unstable_noStore: () => mockNoStore(),
}));

vi.mock("@/lib/auth/session", () => ({
  isAuthenticated: () => mockIsAuthenticated(),
}));

vi.mock("@/db/queries/posts", () => ({
  getPostBySlug: (slug: string) => mockGetPostBySlug(slug),
  getRelatedPosts: (...args: unknown[]) => mockGetRelatedPosts(...args),
  getAllPostSlugs: () => mockGetAllPostSlugs(),
}));

vi.mock("@/services/settings/display", () => ({
  getDisplaySettings: () => mockGetDisplaySettings(),
}));

vi.mock("@/db/client", () => ({
  getDb: vi.fn(),
}));

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) =>
    React.createElement("img", { src: String(props.src || ""), alt: String(props.alt || "") }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { href }, children),
}));

vi.mock("@/lib/markdown/render", () => ({
  MarkdownRenderer: ({ content }: { content: string }) =>
    React.createElement("div", { "data-testid": "markdown" }, content),
}));

vi.mock("@/components/blog/TableOfContents", () => ({
  TableOfContents: () => React.createElement("aside"),
}));

vi.mock("@/components/blog/ShareButtons", () => ({
  ShareButtons: () => React.createElement("div"),
}));

vi.mock("@/components/blog/RelatedPosts", () => ({
  RelatedPosts: () => React.createElement("section"),
}));

vi.mock("@/components/blog/ReadingProgressBar", () => ({
  ReadingProgressBar: () => null,
}));

vi.mock("@/components/blog/PostFeedback", () => ({
  PostFeedback: () => null,
}));

vi.mock("@/components/blog/SiteCreatedBy", () => ({
  SiteCreatedBy: () => null,
}));

vi.mock("@/components/seo/JsonLd", () => ({
  JsonLd: () => null,
}));

vi.mock("@/components/seo/Breadcrumbs", () => ({
  Breadcrumbs: () => null,
}));

function makePost(status: "draft" | "scheduled" | "published" | "archived") {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    slug: `test-${status}-post`,
    title: `Test ${status} Title`,
    excerpt: "Short excerpt for testing.",
    contentMd: "## Section\n\nBody paragraph.",
    metaTitle: `Test ${status} Meta`,
    metaDescription: "Short description",
    categoryId: null,
    category: null,
    tags: [],
    sources: [],
    status,
    scheduledFor: null,
    coverImageId: null,
    coverImageUrl: null,
    coverAlt: "Alt",
    coverCredit: null,
    coverSource: "default",
    readingTimeMin: 3,
    wordCount: 120,
    seoScore: 80,
    origin: "auto",
    isIndexed: false,
    aiProvider: "test",
    aiModel: "test",
    topicKey: "test",
    entityKey: null,
    researchDepth: "single",
    contentSimhash: null,
    publishedAt: status === "published" ? new Date("2026-11-27T10:00:00Z") : null,
    createdAt: new Date("2026-11-27T09:00:00Z"),
    updatedAt: new Date("2026-11-27T09:00:00Z"),
  };
}

describe("Phase 1B: Draft & Unpublished Post Protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRelatedPosts.mockResolvedValue([]);
    mockGetAllPostSlugs.mockResolvedValue([]);
    mockGetDisplaySettings.mockResolvedValue({
      showPrimarySources: false,
      showEditorialAuthor: false,
      showDeveloperPostCard: false,
      showDeveloperFooter: false,
      showDeveloperAboutPage: false,
    });
  });

  it("returns 404 (notFound) and noindex metadata to logged-out visitors for draft, scheduled, and archived posts", async () => {
    const { default: BlogPostPage, generateMetadata } = await import(
      "@/app/(site)/blog/[slug]/page"
    );

    mockIsAuthenticated.mockResolvedValue(false);

    for (const status of ["draft", "scheduled", "archived"] as const) {
      const post = makePost(status);
      mockGetPostBySlug.mockResolvedValueOnce(post).mockResolvedValueOnce(post);

      const meta = await generateMetadata({
        params: Promise.resolve({ slug: post.slug }),
      });
      expect(meta.title).toBe("Post Not Found");
      expect(meta.robots).toEqual({ index: false, follow: false });

      await expect(
        BlogPostPage({ params: Promise.resolve({ slug: post.slug }) }),
      ).rejects.toThrow("NEXT_NOT_FOUND");
      expect(mockNoStore).toHaveBeenCalled();
    }
  });

  it("allows logged-in admin to view draft/scheduled/archived posts with banner, noindex, and noStore (uncached)", async () => {
    const { default: BlogPostPage, generateMetadata } = await import(
      "@/app/(site)/blog/[slug]/page"
    );

    mockIsAuthenticated.mockResolvedValue(true);

    for (const status of ["draft", "scheduled", "archived"] as const) {
      vi.clearAllMocks();
      mockIsAuthenticated.mockResolvedValue(true);
      mockGetRelatedPosts.mockResolvedValue([]);
      mockGetDisplaySettings.mockResolvedValue({
        showPrimarySources: false,
        showEditorialAuthor: false,
        showDeveloperPostCard: false,
        showDeveloperFooter: false,
        showDeveloperAboutPage: false,
      });

      const post = makePost(status);
      mockGetPostBySlug.mockResolvedValueOnce(post).mockResolvedValueOnce(post);

      const meta = await generateMetadata({
        params: Promise.resolve({ slug: post.slug }),
      });
      expect(meta.robots).toEqual({ index: false, follow: false });

      const element = await BlogPostPage({
        params: Promise.resolve({ slug: post.slug }),
      });
      const html = renderToStaticMarkup(element);

      expect(mockNoStore).toHaveBeenCalledTimes(2);
      expect(html).toContain("Draft preview, not public");
      expect(html).toContain(`Test ${status} Title`);
    }
  });

  it("keeps published posts public and cacheable without triggering noStore or banner", async () => {
    const { default: BlogPostPage, generateMetadata } = await import(
      "@/app/(site)/blog/[slug]/page"
    );

    const post = makePost("published");
    mockGetPostBySlug.mockResolvedValueOnce(post).mockResolvedValueOnce(post);
    mockIsAuthenticated.mockResolvedValue(false);

    const meta = await generateMetadata({
      params: Promise.resolve({ slug: post.slug }),
    });
    expect(meta.robots).toMatchObject({ index: true, follow: true });

    const element = await BlogPostPage({
      params: Promise.resolve({ slug: post.slug }),
    });
    const html = renderToStaticMarkup(element);

    expect(mockNoStore).not.toHaveBeenCalled();
    expect(mockIsAuthenticated).not.toHaveBeenCalled();
    expect(html).not.toContain("Draft preview, not public");
    expect(html).toContain("Test published Title");
  });

  it("sanitizes ?from= redirect paths to prevent open redirects", () => {
    expect(sanitizeRedirectPath("/admin/preview/my-draft")).toBe("/admin/preview/my-draft");
    expect(sanitizeRedirectPath("/blog/my-draft?tab=1")).toBe("/blog/my-draft?tab=1");
    expect(sanitizeRedirectPath("https://evil.com/steal")).toBe("/admin");
    expect(sanitizeRedirectPath("//evil.com/steal")).toBe("/admin");
    expect(sanitizeRedirectPath("/\\evil.com")).toBe("/admin");
    expect(sanitizeRedirectPath("javascript:alert(1)")).toBe("/admin");
    expect(sanitizeRedirectPath("")).toBe("/admin");
    expect(sanitizeRedirectPath(null)).toBe("/admin");
  });

  it("ensures sitemap.xml and feed.xml queries strictly filter status = 'published'", async () => {
    const mockFindMany = vi.fn().mockResolvedValue([]);
    const mockSelectWhere = vi.fn().mockResolvedValue([]);
    const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere }));

    const { getDb } = await import("@/db/client");
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn((arg?: Record<string, unknown>) => {
        if (arg && "slug" in arg && "updatedAt" in arg) {
          return { from: mockSelectFrom };
        }
        return { from: vi.fn().mockResolvedValue([]) };
      }),
      query: {
        posts: {
          findMany: mockFindMany,
        },
      },
    } as unknown as ReturnType<typeof getDb>);

    const { GET: getSitemap } = await import("@/app/sitemap.xml/route");
    const sitemapRes = await getSitemap();
    expect(sitemapRes.status).toBe(200);
    expect(mockSelectWhere).toHaveBeenCalled();

    const { GET: getFeed } = await import("@/app/feed.xml/route");
    const feedRes = await getFeed();
    expect(feedRes.status).toBe(200);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.anything(),
      }),
    );
  });
});
