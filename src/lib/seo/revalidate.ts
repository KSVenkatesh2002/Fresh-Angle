import { revalidatePath } from "next/cache";

export interface RevalidateTargets {
  slug?: string | null;
  categorySlug?: string | null;
  tagSlugs?: string[];
}

/**
 * Revalidates public listings, feeds, sitemaps, archives, and optional post/taxonomy pages.
 */
export function revalidatePublicSitePaths(targets: RevalidateTargets = {}): void {
  revalidatePath("/", "page");
  revalidatePath("/blog", "page");
  revalidatePath("/blog/page/[n]", "page");
  revalidatePath("/categories", "page");
  revalidatePath("/tags", "page");
  revalidatePath("/archive", "page");
  revalidatePath("/sitemap", "page");
  revalidatePath("/rss", "page");
  revalidatePath("/sitemap.xml");
  revalidatePath("/feed.xml");

  if (targets.slug) {
    revalidatePath(`/blog/${targets.slug}`, "page");
  }
  if (targets.categorySlug) {
    revalidatePath(`/category/${targets.categorySlug}`, "page");
    revalidatePath(`/feed/category/${targets.categorySlug}`);
  }
  if (Array.isArray(targets.tagSlugs)) {
    for (const tagSlug of targets.tagSlugs) {
      if (tagSlug) {
        revalidatePath(`/tag/${tagSlug}`, "page");
      }
    }
  }
}

