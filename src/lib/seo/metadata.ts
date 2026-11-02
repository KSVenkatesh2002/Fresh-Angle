import type { Metadata } from "next";
import { siteConfig } from "@/config/site";

interface PostMetadataProps {
  title: string;
  description: string;
  slug: string;
  publishedAt?: Date | string | null;
  updatedAt?: Date | string | null;
  coverImageId?: string | null;
  categoryName?: string;
  tags?: string[];
}

export function constructPostMetadata({
  title,
  description,
  slug,
  publishedAt,
  updatedAt,
  coverImageId,
  tags = [],
}: PostMetadataProps): Metadata {
  const postUrl = `${siteConfig.url}/blog/${slug}`;
  const imageUrl = coverImageId
    ? `${siteConfig.url}/api/images/${coverImageId}`
    : `${siteConfig.url}/opengraph-image`;

  const pubDate = publishedAt ? new Date(publishedAt).toISOString() : undefined;
  const modDate = updatedAt ? new Date(updatedAt).toISOString() : pubDate;

  return {
    title,
    description,
    alternates: {
      canonical: postUrl,
    },
    openGraph: {
      type: "article",
      title,
      description,
      url: postUrl,
      siteName: siteConfig.name,
      publishedTime: pubDate,
      modifiedTime: modDate,
      authors: [siteConfig.author.name],
      tags,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
      creator: "@freshangle_ai",
    },
    robots: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  };
}

export function constructPageMetadata({
  title,
  description,
  path = "",
  noIndex = false,
}: {
  title: string;
  description: string;
  path?: string;
  noIndex?: boolean;
}): Metadata {
  const url = `${siteConfig.url}${path}`;
  const ogImageUrl = `${siteConfig.url}/opengraph-image`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: "website",
      title,
      description,
      url,
      siteName: siteConfig.name,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${siteConfig.name} - ${title}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
    robots: noIndex
      ? {
          index: false,
          follow: false,
        }
      : {
          index: true,
          follow: true,
          "max-video-preview": -1,
          "max-image-preview": "large",
          "max-snippet": -1,
        },
  };
}
