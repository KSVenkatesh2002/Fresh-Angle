import React from "react";
import { PostWithRelations } from "@/db/queries/posts";
import { PostCard } from "./PostCard";
import { Newspaper } from "lucide-react";

interface PostListProps {
  posts: PostWithRelations[];
  emptyMessage?: string;
}

export function PostList({
  posts,
  emptyMessage = "No articles found in this section yet. Check back tomorrow!",
}: PostListProps): React.JSX.Element {
  if (posts.length === 0) {
    return (
      <div className="text-center py-16 px-4 rounded-xl border border-dashed border-border bg-surface/50 my-8">
        <Newspaper className="w-10 h-10 text-foreground-muted mx-auto mb-3 opacity-60" />
        <h2 className="text-lg font-semibold text-foreground mb-1">
          No Articles Published
        </h2>
        <p className="text-sm text-foreground-muted max-w-sm mx-auto">
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 my-8">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
