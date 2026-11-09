import React from "react";
import type { Metadata } from "next";
import { getDb } from "@/db/client";
import { contactMessages, postFeedback } from "@/db/schema";
import { desc } from "drizzle-orm";
import { Mail, MessageSquare, ThumbsUp, ThumbsDown } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Inbound Transmissions & Reader Feedback",
  robots: { index: false, follow: false },
};

export default async function AdminMessagesPage(): Promise<React.JSX.Element> {
  const db = getDb();
  const [messagesList, feedbackList] = await Promise.all([
    db.query.contactMessages.findMany({
      orderBy: [desc(contactMessages.createdAt)],
      limit: 25,
    }),
    db.query.postFeedback.findMany({
      orderBy: [desc(postFeedback.createdAt)],
      limit: 30,
      with: { post: true },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
          Inbound Transmissions & Reader Feedback
        </h1>
        <p className="text-sm text-foreground-muted">
          Submissions received via the contact gateway and reader accuracy
          feedback.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contact Messages */}
        <div className="p-6 rounded-2xl bg-surface border border-border space-y-4">
          <h2 className="text-base font-bold text-foreground flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              <span>Contact Inquiries ({messagesList.length})</span>
            </span>
          </h2>

          {messagesList.length === 0 ? (
            <p className="text-xs text-foreground-muted">
              No contact messages received yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {messagesList.map((msg) => (
                <li
                  key={msg.id}
                  className="p-4 rounded-xl bg-surface-muted border border-border space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">
                      {msg.name}
                    </span>
                    <span className="text-[10px] text-foreground-muted">
                      {new Date(msg.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-primary font-medium">{msg.subject}</p>
                  <p className="text-foreground-muted leading-relaxed whitespace-pre-line">
                    {msg.message}
                  </p>
                  <p className="text-[10px] text-foreground-muted">
                    Email: {msg.email}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Post Feedback */}
        <div className="p-6 rounded-2xl bg-surface border border-border space-y-4">
          <h2 className="text-base font-bold text-foreground flex items-center justify-between">
            <span className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              <span>Article Accuracy Ratings ({feedbackList.length})</span>
            </span>
          </h2>

          {feedbackList.length === 0 ? (
            <p className="text-xs text-foreground-muted">
              No reader feedback logged yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {feedbackList.map((fb) => (
                <li
                  key={fb.id}
                  className="p-4 rounded-xl bg-surface-muted border border-border space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground truncate max-w-xs">
                      {fb.post?.title || "Unknown Dispatch"}
                    </span>
                    <span className="flex items-center gap-1">
                      {fb.wasHelpful ? (
                        <span className="inline-flex items-center gap-1 text-success text-[11px] font-semibold">
                          <ThumbsUp className="w-3.5 h-3.5" /> Helpful
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-danger text-[11px] font-semibold">
                          <ThumbsDown className="w-3.5 h-3.5" /> Issue
                        </span>
                      )}
                    </span>
                  </div>
                  {fb.feedbackText && (
                    <p className="text-foreground-muted italic bg-surface p-2.5 rounded-lg border border-border">
                      &ldquo;{fb.feedbackText}&rdquo;
                    </p>
                  )}
                  <span className="text-[10px] text-foreground-muted">
                    {new Date(fb.createdAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
