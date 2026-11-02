"use client";

import React, { useState } from "react";
import { Check, Copy } from "lucide-react";

interface ShareButtonsProps {
  url: string;
  title: string;
}

export function ShareButtons({
  url,
  title,
}: ShareButtonsProps): React.JSX.Element {
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    title,
  )}&url=${encodeURIComponent(url)}`;

  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
    url,
  )}`;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wider text-foreground-muted mr-1">
        Share:
      </span>

      <a
        href={twitterUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on X (formerly Twitter)"
        className="w-8 h-8 rounded-lg border border-border bg-surface hover:bg-surface-muted text-foreground flex items-center justify-center transition-colors text-xs font-bold"
      >
        𝕏
      </a>

      <a
        href={linkedinUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on LinkedIn"
        className="w-8 h-8 rounded-lg border border-border bg-surface hover:bg-surface-muted text-foreground flex items-center justify-center transition-colors text-xs font-semibold"
      >
        in
      </a>

      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy post link"
        className="h-8 px-2.5 rounded-lg border border-border bg-surface hover:bg-surface-muted text-foreground flex items-center gap-1.5 transition-colors text-xs font-medium cursor-pointer"
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5 text-success" />
            <span className="text-success">Copied!</span>
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5 text-foreground-muted" />
            <span>Copy Link</span>
          </>
        )}
      </button>
    </div>
  );
}
