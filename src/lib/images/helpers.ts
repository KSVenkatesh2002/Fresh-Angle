import { siteConfig } from "@/config/site";

export interface PostCoverSource {
  coverImageUrl?: string | null;
  coverImageId?: string | null;
}

/**
 * Returns the best image URL for a post:
 * 1. Cloudinary direct URL (`coverImageUrl`)
 * 2. Legacy `/api/images/[id]` URL (for backwards compatibility / unmigrated)
 * 3. Default static fallback `/images/fallback-cover.webp`
 */
export function getCoverImageUrl(post?: PostCoverSource | null): string {
  if (!post) {
    return "/images/fallback-cover.webp";
  }

  if (post.coverImageUrl && post.coverImageUrl.trim().length > 0) {
    return post.coverImageUrl;
  }

  if (post.coverImageId && post.coverImageId.trim().length > 0) {
    return `/api/images/${post.coverImageId}`;
  }

  return "/images/fallback-cover.webp";
}

/**
 * Returns an absolute URL for SEO metadata, Open Graph, Twitter, JSON-LD, and RSS feeds.
 */
export function getAbsoluteCoverImageUrl(
  post?: PostCoverSource | null,
  siteUrl: string = siteConfig.url,
): string {
  const relativeOrAbsolute = getCoverImageUrl(post);
  if (
    relativeOrAbsolute.startsWith("http://") ||
    relativeOrAbsolute.startsWith("https://")
  ) {
    return relativeOrAbsolute;
  }

  const cleanBase = siteUrl.replace(/\/$/, "");
  const cleanPath = relativeOrAbsolute.startsWith("/")
    ? relativeOrAbsolute
    : `/${relativeOrAbsolute}`;
  return `${cleanBase}${cleanPath}`;
}

/**
 * Custom Cloudinary loader for Next.js <Image /> component or manual image URLs.
 * Injects responsive width and automatic WebP/AVIF format + quality compression.
 */
export function cloudinaryLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  if (!src.includes("res.cloudinary.com")) {
    return src;
  }

  const q = quality || "auto";
  const transform = `f_auto,q_${q},w_${width},c_limit`;

  // If already contains upload/..., insert or replace transformation
  if (src.includes("/image/upload/")) {
    return src.replace(
      /\/image\/upload\/(?:[a-z0-9_,:]+\/)?/,
      `/image/upload/${transform}/`,
    );
  }

  return src;
}

