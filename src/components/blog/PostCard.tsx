import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { PostWithRelations } from '@/db/queries/posts';
import { formatDate } from '@/lib/utils/dates';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Clock, Calendar } from 'lucide-react';

interface PostCardProps {
  post: PostWithRelations;
  featured?: boolean;
}

export function PostCard({ post, featured = false }: PostCardProps): React.JSX.Element {
  const imageUrl = post.coverImageId
    ? `/api/images/${post.coverImageId}`
    : '/opengraph-image';

  return (
    <Card hoverEffect className={`flex flex-col h-full ${featured ? 'md:grid md:grid-cols-2 md:gap-6' : ''}`}>
      {/* Cover Image */}
      <Link
        href={`/blog/${post.slug}`}
        className="relative block w-full aspect-[16/9] overflow-hidden bg-surface-muted group"
        tabIndex={-1}
        aria-hidden="true"
      >
        <Image
          src={imageUrl}
          alt={post.coverAlt || post.title}
          fill
          sizes={featured ? '(max-width: 768px) 100vw, 50vw' : '(max-width: 768px) 100vw, 33vw'}
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {post.category && (
          <div className="absolute top-3 left-3">
            <Badge variant="primary" className="backdrop-blur-md bg-surface/90">
              {post.category.name}
            </Badge>
          </div>
        )}
      </Link>

      {/* Content */}
      <div className="flex flex-col flex-1 p-5 sm:p-6">
        {/* Meta row */}
        <div className="flex items-center gap-3 text-xs text-foreground-muted mb-3">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            <time dateTime={post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined}>
              {formatDate(post.publishedAt)}
            </time>
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>{post.readingTimeMin} min read</span>
          </span>
        </div>

        {/* Title */}
        <h2 className={`font-bold tracking-tight text-foreground hover:text-primary transition-colors line-clamp-2 ${featured ? 'text-2xl sm:text-3xl mb-3' : 'text-lg sm:text-xl mb-2'}`}>
          <Link href={`/blog/${post.slug}`} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
            {post.title}
          </Link>
        </h2>

        {/* Excerpt */}
        <p className="text-foreground-muted text-sm line-clamp-3 leading-relaxed mb-4 flex-1">
          {post.excerpt}
        </p>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-3 border-t border-border mt-auto">
            {post.tags.slice(0, 3).map((tag) => (
              <Link
                key={tag.id}
                href={`/tag/${tag.slug}`}
                className="text-[11px] text-foreground-muted hover:text-primary transition-colors py-0.5 px-2 rounded-md bg-surface-muted border border-border"
              >
                #{tag.name}
              </Link>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
