"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { CheckCircle2, Archive, Trash2, Send } from "lucide-react";

import { PostHoldReason, XPostStatus } from "@/db/schema";

interface AdminPostActionsProps {
  postId: string;
  status: "draft" | "scheduled" | "published" | "archived";
  title: string;
  holdReason?: PostHoldReason | null;
  holdDetail?: string | null;
  xPostStatus?: XPostStatus | null;
  xPostError?: string | null;
}

export function AdminPostActions({
  postId,
  status,
  title,
  holdReason,
  holdDetail,
  xPostStatus,
  xPostError,
}: AdminPostActionsProps): React.JSX.Element {
  const router = useRouter();
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const handleStatusChange = async (
    nextStatus: "draft" | "published",
  ): Promise<void> => {
    if (nextStatus === "published" && holdReason === "originality_gate") {
      const detailLine = holdDetail ? `\n\nReason: ${holdDetail}` : "";
      const confirmed = confirm(
        `Warning: "${title}" failed the originality check and was held as a draft.${detailLine}\n\nAre you sure you want to approve and publish it anyway?`,
      );
      if (!confirmed) return;
    }

    setBusyAction(nextStatus);
    try {
      const res = await fetch(`/api/admin/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update status");
      }
      router.refresh();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusyAction(null);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!confirm(`Permanently delete "${title}"?`)) return;
    setBusyAction("delete");
    try {
      const res = await fetch(`/api/admin/posts/${postId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete post");
      }
      router.refresh();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusyAction(null);
    }
  };

  const handleRetryXPost = async (): Promise<void> => {
    setBusyAction("x-post");
    try {
      const res = await fetch(`/api/admin/posts/${postId}/x-post`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        alert(data.message || data.error || "Failed to post to X");
      }
      router.refresh();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusyAction(null);
    }
  };

  const canRetryX =
    status === "published" &&
    (xPostStatus === "failed" ||
      xPostStatus === "skipped" ||
      xPostStatus === "pending" ||
      !xPostStatus);

  return (
    <div className="flex items-center justify-end gap-1.5">
      {canRetryX && (
        <Button
          size="sm"
          variant="outline"
          isLoading={busyAction === "x-post"}
          disabled={busyAction !== null}
          onClick={handleRetryXPost}
          title={xPostError ? `Retry X post (${xPostError})` : "Retry posting this article to X via Buffer"}
        >
          <Send className="w-3.5 h-3.5" />
          <span>Retry X post</span>
        </Button>
      )}
      {status !== "published" ? (
        <Button
          size="sm"
          variant="primary"
          isLoading={busyAction === "published"}
          disabled={busyAction !== null}
          onClick={() => handleStatusChange("published")}
          title="Publish post and update blog, sitemap, and RSS"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Publish</span>
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          isLoading={busyAction === "draft"}
          disabled={busyAction !== null}
          onClick={() => handleStatusChange("draft")}
          title="Move back to draft"
        >
          <Archive className="w-3.5 h-3.5" />
          <span>Draft</span>
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        isLoading={busyAction === "delete"}
        disabled={busyAction !== null}
        onClick={handleDelete}
        title="Delete post"
        className="text-danger hover:bg-danger/10"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

