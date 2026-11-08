import { siteConfig } from "@/config/site";
import { getAbsoluteCoverImageUrl } from "@/lib/images/helpers";

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export function generateWebsiteJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteConfig.url}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function generateOrganizationJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: siteConfig.url,
    logo: `${siteConfig.url}/opengraph-image`,
    sameAs: [siteConfig.social.x, siteConfig.social.github].filter(Boolean),
  };
}

export function generateArticleJsonLd(post: {
  title: string;
  description: string;
  slug: string;
  publishedAt?: Date | string | null;
  updatedAt?: Date | string | null;
  coverImageId?: string | null;
  coverImageUrl?: string | null;
  categoryName?: string;
  authorName?: string;
}): Record<string, unknown> {
  const postUrl = `${siteConfig.url}/blog/${post.slug}`;
  const imageUrl = getAbsoluteCoverImageUrl(
    { coverImageUrl: post.coverImageUrl, coverImageId: post.coverImageId },
    siteConfig.url,
  );

  const pubDate = post.publishedAt
    ? new Date(post.publishedAt).toISOString()
    : new Date().toISOString();
  const modDate = post.updatedAt
    ? new Date(post.updatedAt).toISOString()
    : pubDate;

  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": postUrl,
    },
    headline: post.title,
    description: post.description,
    image: [imageUrl],
    datePublished: pubDate,
    dateModified: modDate,
    author: {
      "@type": "Person",
      name: post.authorName || siteConfig.author.name,
      url: siteConfig.author.url,
    },
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      url: siteConfig.url,
      logo: {
        "@type": "ImageObject",
        url: `${siteConfig.url}/opengraph-image`,
      },
    },
    articleSection: post.categoryName || "Artificial Intelligence",
  };
}

export function generateBreadcrumbJsonLd(
  items: BreadcrumbItem[],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url.startsWith("http")
        ? item.url
        : `${siteConfig.url}${item.url}`,
    })),
  };
}

export function generateFaqJsonLd(
  faqs: FaqItem[],
): Record<string, unknown> | null {
  if (!faqs || faqs.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export function generatePersonJsonLd(): Record<string, unknown> | null {
  if (!siteConfig.creator) return null;
  const creator = siteConfig.creator;

  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: creator.name,
    url: creator.url,
    image: `${siteConfig.url}${creator.image}`,
    jobTitle: "Founder & Software Architect",
    sameAs: [creator.url, siteConfig.social.github].filter(Boolean),
    description: creator.bio,
  };
}

export function generateCollectionJsonLd(
  title: string,
  description: string,
  url: string,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    url: url.startsWith("http") ? url : `${siteConfig.url}${url}`,
  };
}
