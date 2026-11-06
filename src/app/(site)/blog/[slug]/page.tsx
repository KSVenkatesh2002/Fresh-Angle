import React from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPostBySlug,
  getRelatedPosts,
  getAllPostSlugs,
} from "@/db/queries/posts";
import { extractTableOfContents } from "@/lib/markdown/toc";
import { MarkdownRenderer } from "@/lib/markdown/render";
import { formatDate } from "@/lib/utils/dates";
import { Container } from "@/components/layout/Container";
import { Badge } from "@/components/ui/Badge";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { TableOfContents } from "@/components/blog/TableOfContents";
import { ShareButtons } from "@/components/blog/ShareButtons";
import { RelatedPosts } from "@/components/blog/RelatedPosts";
import { AiDisclosureBadge } from "@/components/blog/AiDisclosureBadge";
import { constructPostMetadata } from "@/lib/seo/metadata";
import { generateArticleJsonLd, generateFaqJsonLd } from "@/lib/seo/jsonld";
import { siteConfig } from "@/config/site";
import { ReadingProgressBar } from "@/components/blog/ReadingProgressBar";
import { PostFeedback } from "@/components/blog/PostFeedback";
import { SiteCreatedBy } from "@/components/blog/SiteCreatedBy";
import {
  Calendar,
  Clock,
  ExternalLink,
  HelpCircle,
  UserCheck,
} from "lucide-react";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  try {
    const slugs = await getAllPostSlugs();
    return slugs.map((slug) => ({ slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    return {
      title: "Post Not Found",
    };
  }

  return constructPostMetadata({
    title: post.metaTitle || post.title,
    description: post.metaDescription || post.excerpt,
    slug: post.slug,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt,
    coverImageId: post.coverImageId,
    categoryName: post.category?.name,
    tags: post.tags?.map((t) => t.name),
  });
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<React.JSX.Element> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const postUrl = `${siteConfig.url}/blog/${post.slug}`;
  const tocItems = extractTableOfContents(post.contentMd);

  // Parse FAQ from content if present or generate fallback
  let faqs: Array<{ question: string; answer: string }> = [];
  try {
    // Check if FAQ section exists in markdown or metadata
    const faqRegex = /##\s*Frequently Asked Questions[\s\S]*?(?=(##|$))/i;
    const match = post.contentMd.match(faqRegex);
    if (match) {
      const qBlocks = match[0].split(/###\s+/).slice(1);
      faqs = qBlocks
        .map((block) => {
          const [q, ...ans] = block.split("\n");
          return {
            question: q.trim(),
            answer: ans.join(" ").trim(),
          };
        })
        .filter((f) => f.question && f.answer);
    }
  } catch {
    // Safe fallback
  }

  const relatedPosts = await getRelatedPosts(post.id, post.categoryId, 3);

  const articleJsonLd = generateArticleJsonLd({
    title: post.title,
    description: post.excerpt,
    slug: post.slug,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt,
    coverImageId: post.coverImageId,
    categoryName: post.category?.name,
  });

  const faqJsonLd = generateFaqJsonLd(faqs);

  const imageUrl = post.coverImageId
    ? `/api/images/${post.coverImageId}`
    : "/opengraph-image";

  return (
    <main className="py-8 sm:py-12 relative">
      <ReadingProgressBar />
      <JsonLd data={faqJsonLd ? [articleJsonLd, faqJsonLd] : articleJsonLd} />

      <Container size="wide">
        <Breadcrumbs
          items={[
            { name: "Blog", url: "/blog" },
            ...(post.category
              ? [
                  {
                    name: post.category.name,
                    url: `/category/${post.category.slug}`,
                  },
                ]
              : []),
            { name: post.title, url: `/blog/${post.slug}` },
          ]}
        />

        <div className="mt-6 flex flex-col xl:flex-row items-start justify-center gap-12">
          {/* Main Article Content */}
          <article className="w-full xl:max-w-4xl min-w-0">
          {/* Header metadata */}
          <header className="space-y-4 mb-8">
            <div className="flex flex-wrap items-center gap-2">
              {post.category && (
                <Link href={`/category/${post.category.slug}`}>
                  <Badge variant="primary" className="cursor-pointer">
                    {post.category.name}
                  </Badge>
                </Link>
              )}
              <span className="text-xs text-foreground-muted">•</span>
              <time
                dateTime={
                  post.publishedAt
                    ? new Date(post.publishedAt).toISOString()
                    : undefined
                }
                className="text-xs text-foreground-muted flex items-center gap-1"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Published {formatDate(post.publishedAt)}</span>
              </time>
              <span className="text-xs text-foreground-muted">•</span>
              <span className="text-xs text-foreground-muted flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>{post.readingTimeMin} min read</span>
              </span>
            </div>

            {/* Exactly ONE single H1 on the page */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground leading-[1.18]">
              {post.title}
            </h1>

            {/* Excerpt Lead */}
            <p className="text-lg sm:text-xl text-foreground-muted leading-relaxed font-normal">
              {post.excerpt}
            </p>

            {/* Author Attribution & Share */}
            <div className="py-4 border-y border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground leading-tight">
                    {siteConfig.author.name}
                  </p>
                  <p className="text-xs text-foreground-muted">
                    Autonomous Intelligence Synthesis
                  </p>
                </div>
              </div>

              <ShareButtons url={postUrl} title={post.title} />
            </div>
          </header>

          {/* Post Cover Image with priority */}
          <figure className="relative aspect-[16/9] w-full rounded-2xl overflow-hidden bg-surface-muted border border-border shadow-md mb-8">
            <Image
              src={imageUrl}
              alt={post.coverAlt || post.title}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 896px"
              className="object-cover"
            />
            {post.coverCredit && (
              <figcaption className="absolute bottom-2 right-2 px-2.5 py-1 rounded bg-surface/85 backdrop-blur-sm text-[10px] text-foreground-muted border border-border">
                {post.coverCredit}
              </figcaption>
            )}
          </figure>

          {/* AI-Assisted Disclosure Badge */}
          <div className="mb-8">
            <AiDisclosureBadge
              provider={post.aiProvider}
              model={post.aiModel}
            />
          </div>

            {/* Table of Contents (Mobile & Tablet collapsible) */}
            <TableOfContents items={tocItems} variant="inline" />

          {/* Rendered Markdown Post Body */}
          <section className="mt-8 mb-12">
            <MarkdownRenderer content={post.contentMd} />
          </section>

          {/* FAQ Section (if present) */}
          {faqs.length > 0 && (
            <section
              aria-labelledby="faq-heading"
              className="my-12 p-6 sm:p-8 rounded-2xl bg-surface border border-border"
            >
              <div className="flex items-center gap-2 mb-6">
                <HelpCircle className="w-5 h-5 text-primary" />
                <h2
                  id="faq-heading"
                  className="text-xl sm:text-2xl font-bold tracking-tight text-foreground"
                >
                  Frequently Asked Questions
                </h2>
              </div>
              <div className="space-y-4">
                {faqs.map((faq, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-xl bg-surface-muted border border-border"
                  >
                    <h3 className="text-base font-semibold text-foreground mb-2">
                      {faq.question}
                    </h3>
                    <p className="text-sm text-foreground-muted leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Primary Research Sources */}
          {post.sources && post.sources.length > 0 && (
            <section
              aria-labelledby="sources-heading"
              className="my-10 p-6 rounded-2xl bg-surface-muted/50 border border-border"
            >
              <h2
                id="sources-heading"
                className="text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-3"
              >
                Primary Research Sources & Dispatches
              </h2>
              <ul className="space-y-2">
                {post.sources.map((source) => (
                  <li
                    key={source.id}
                    className="text-sm flex items-start gap-2"
                  >
                    <ExternalLink className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-foreground hover:text-primary transition-colors underline-offset-4 hover:underline"
                      >
                        {source.title}
                      </a>
                      <span className="text-xs text-foreground-muted ml-2">
                        ({source.publisher})
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 my-8 pt-6 border-t border-border">
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground-muted mr-1">
                Tags:
              </span>
              {post.tags.map((tag) => (
                <Link key={tag.id} href={`/tag/${tag.slug}`}>
                  <Badge
                    variant="outline"
                    className="hover:border-primary hover:text-primary transition-colors cursor-pointer"
                  >
                    #{tag.name}
                  </Badge>
                </Link>
              ))}
            </div>
          )}

          {/* Post Feedback Widget */}
          <PostFeedback postId={post.id} />

          {/* Site Created By Card */}
          <SiteCreatedBy />

          {/* Related Articles */}
          <RelatedPosts posts={relatedPosts} />
        </article>

        {/* Desktop Sticky Sidebar Table of Contents */}
        <TableOfContents items={tocItems} variant="sidebar" />
      </div>
    </Container>
    </main>
  );
}
