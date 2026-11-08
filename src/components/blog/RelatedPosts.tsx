import React from "react";
import Link from "next/link";
import Image from "next/image";
import { PostWithRelations } from "@/db/queries/posts";
import { formatDate } from "@/lib/utils/dates";
import { getCoverImageUrl } from "@/lib/images/helpers";
import { Sparkles } from "lucide-react";

interface RelatedPostsProps {
  posts: PostWithRelations[];
}

export function RelatedPosts({
  posts,
}: RelatedPostsProps): React.JSX.Element | null {
  if (posts.length === 0) return null;

  return (
    <section
      aria-labelledby="related-posts-heading"
      className="mt-16 pt-10 border-t border-border"
    >
      <div className="flex items-center gap-2 mb-6">
        <Sparkles className="w-5 h-5 text-primary" />
        <h2
          id="related-posts-heading"
          className="text-xl font-bold tracking-tight text-foreground"
        >
          Related Articles
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {posts.map((post) => {
          const imageUrl = getCoverImageUrl(post);

          return (
            <article
              key={post.id}
              className="flex flex-col rounded-xl border border-border bg-surface overflow-hidden group hover:border-primary/50 transition-colors"
            >
              <Link
                href={`/blog/${post.slug}`}
                className="relative aspect-[16/9] w-full overflow-hidden bg-surface-muted"
                tabIndex={-1}
                aria-hidden="true"
              >
                <Image
                  src={imageUrl}
                  alt={post.coverAlt || post.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </Link>

              <div className="p-4 flex flex-col flex-1">
                <time
                  dateTime={
                    post.publishedAt
                      ? new Date(post.publishedAt).toISOString()
                      : undefined
                  }
                  className="text-[11px] text-foreground-muted mb-1.5"
                >
                  {formatDate(post.publishedAt)}
                </time>

                <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-2">
                  <Link
                    href={`/blog/${post.slug}`}
                    className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  >
                    {post.title}
                  </Link>
                </h3>

                <p className="text-xs text-foreground-muted line-clamp-2 mt-auto">
                  {post.excerpt}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
