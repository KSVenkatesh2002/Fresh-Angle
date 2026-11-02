import React from 'react';
import Link from 'next/link';
import { getPublishedPosts } from '@/db/queries/posts';
import { Container } from '@/components/layout/Container';
import { Badge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/utils/dates';
import { ArrowLeft, ExternalLink } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminPostsPage(): Promise<React.JSX.Element> {
  let postsData: Awaited<ReturnType<typeof getPublishedPosts>>['posts'] = [];

  try {
    const res = await getPublishedPosts({ page: 1, limit: 50 });
    postsData = res.posts;
  } catch (err) {
    console.warn(`⚠️ [AdminPosts] DB error: ${(err as Error).message}`);
  }

  return (
    <main className="py-8 sm:py-12">
      <Container>
        <div className="flex items-center justify-between pb-6 border-b border-border mb-8">
          <div>
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 text-xs text-foreground-muted hover:text-primary transition-colors mb-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              All Briefings ({postsData.length})
            </h1>
          </div>
        </div>

        <div className="border border-border rounded-xl bg-surface overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-xs font-semibold text-foreground-muted uppercase tracking-wider">
                <th className="py-3 px-4">Title</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Published</th>
                <th className="py-3 px-4">AI Model</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {postsData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-foreground-muted">
                    No posts found in database.
                  </td>
                </tr>
              ) : (
                postsData.map((post) => (
                  <tr key={post.id} className="hover:bg-surface-muted/40 transition-colors">
                    <td className="py-3 px-4 font-medium text-foreground max-w-sm truncate">
                      <Link
                        href={`/blog/${post.slug}`}
                        className="hover:text-primary transition-colors flex items-center gap-1.5"
                        target="_blank"
                      >
                        <span>{post.title}</span>
                        <ExternalLink className="w-3 h-3 text-foreground-muted" />
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline">{post.category?.name || 'General'}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="success">{post.status}</Badge>
                    </td>
                    <td className="py-3 px-4 text-xs text-foreground-muted">
                      {formatDate(post.publishedAt)}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-foreground-muted">
                      {post.aiModel}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Container>
    </main>
  );
}
