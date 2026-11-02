'use client';

import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, CheckCircle, AlertTriangle } from 'lucide-react';

interface PostFeedbackProps {
  postId: string;
}

export function PostFeedback({ postId }: PostFeedbackProps): React.JSX.Element {
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [showIssueBox, setShowIssueBox] = useState<boolean>(false);
  const [feedbackText, setFeedbackText] = useState<string>('');

  async function handleVote(wasHelpful: boolean): Promise<void> {
    if (submitting || submitted) return;
    setSubmitting(true);

    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId,
          wasHelpful,
          feedbackText: feedbackText.trim() || undefined,
        }),
      });
      setSubmitted(true);
      setShowIssueBox(false);
    } catch {
      // Silent catch or graceful state
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="p-4 rounded-xl bg-surface border border-border flex items-center gap-2.5 text-sm text-foreground my-8">
        <CheckCircle className="w-4 h-4 text-success shrink-0" />
        <span>Thank you for your feedback! It helps improve our research pipeline.</span>
      </div>
    );
  }

  return (
    <div className="p-5 rounded-xl bg-surface border border-border space-y-3 my-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <span className="text-sm font-medium text-foreground">
          Was this briefing helpful?
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleVote(true)}
            disabled={submitting}
            aria-label="Vote helpful"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface-muted hover:border-primary text-xs font-medium text-foreground transition-colors disabled:opacity-50"
          >
            <ThumbsUp className="w-3.5 h-3.5 text-success" />
            <span>Yes</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setShowIssueBox(true);
            }}
            disabled={submitting}
            aria-label="Vote unhelpful or report issue"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface-muted hover:border-danger text-xs font-medium text-foreground transition-colors disabled:opacity-50"
          >
            <ThumbsDown className="w-3.5 h-3.5 text-danger" />
            <span>No</span>
          </button>
          <button
            type="button"
            onClick={() => setShowIssueBox(!showIssueBox)}
            className="text-xs text-foreground-muted hover:text-foreground transition-colors underline underline-offset-4 ml-2"
          >
            Report an issue
          </button>
        </div>
      </div>

      {showIssueBox && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleVote(false);
          }}
          className="pt-2 border-t border-border space-y-2.5"
        >
          <div className="flex items-center gap-1.5 text-xs text-foreground-muted">
            <AlertTriangle className="w-3.5 h-3.5 text-warning" />
            <span>Notice an error or hallucination? Let us know:</span>
          </div>
          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="Describe the issue or discrepancy..."
            rows={2}
            className="w-full px-3 py-2 text-xs rounded-lg bg-surface-muted border border-border text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowIssueBox(false)}
              className="px-2.5 py-1 text-xs text-foreground-muted hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-3 py-1 text-xs font-medium rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              Submit Issue
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
