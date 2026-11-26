import React from "react";
import Link from "next/link";
import { getAdminPosts } from "@/db/queries/posts";
import { Badge } from "@/components/ui/Badge";
import { AdminPostActions } from "@/components/admin/AdminPostActions";
import { formatDate } from "@/lib/utils/dates";
import { ArrowLeft, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminPostsPage(): Promise<React.JSX.Element> {
  let postsData: Awaited<ReturnType<typeof getAdminPosts>>["posts"] = [];
  let totalCount = 0;

  try {
    const res = await getAdminPosts({ page: 1, limit: 100 });
    postsData = res.posts;
    totalCount = res.total;
  } catch (err) {
    console.warn(`⚠️ [AdminPosts] DB error: ${(err as Error).message}`);
  }

  const draftCount = postsData.filter((p) => p.status === "draft").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-6 border-b border-border">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-xs text-foreground-muted hover:text-primary transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              All Briefings ({totalCount})
            </h1>
            {draftCount > 0 && (
              <Badge variant="warning">{draftCount} draft(s) awaiting review</Badge>
            )}
          </div>
        </div>
        <Link
          href="/admin/posts/new"
          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          Create New Dispatch
        </Link>
      </div>

      <div className="border border-border rounded-xl bg-surface overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-border bg-surface-muted text-xs font-semibold text-foreground-muted uppercase tracking-wider">
              <th className="py-3 px-4">Title</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Depth</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {postsData.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-8 text-center text-foreground-muted"
                >
                  No posts found in database.
                </td>
              </tr>
            ) : (
              postsData.map((post) => {
                const statusVariant =
                  post.status === "published"
                    ? "success"
                    : post.status === "draft"
                      ? "warning"
                      : post.status === "scheduled"
                        ? "primary"
                        : "default";

                return (
                  <tr
                    key={post.id}
                    className="hover:bg-surface-muted/40 transition-colors"
                  >
                    <td className="py-3 px-4 font-medium text-foreground max-w-sm truncate">
                      <Link
                        href={`/blog/${post.slug}`}
                        className="hover:text-primary transition-colors flex items-center gap-1.5"
                        target="_blank"
                      >
                        <span className="truncate">{post.title}</span>
                        <ExternalLink className="w-3 h-3 text-foreground-muted shrink-0" />
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline">
                        {post.category?.name || "General"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={statusVariant}>{post.status}</Badge>
                    </td>
                    <td className="py-3 px-4 text-xs text-foreground-muted whitespace-nowrap">
                      {post.publishedAt
                        ? formatDate(post.publishedAt)
                        : `Created ${formatDate(post.createdAt)}`}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-foreground-muted">
                      {post.researchDepth || "single"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <AdminPostActions
                        postId={post.id}
                        status={post.status}
                        title={post.title}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
