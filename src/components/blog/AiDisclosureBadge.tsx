import React from 'react';
import Link from 'next/link';
import { Bot, HelpCircle } from 'lucide-react';

interface AiDisclosureBadgeProps {
  provider?: string;
  model?: string;
}

export function AiDisclosureBadge({
  provider,
  model,
}: AiDisclosureBadgeProps): React.JSX.Element {
  return (
    <div className="inline-flex flex-wrap items-center gap-2 p-3 rounded-lg bg-surface-muted border border-border text-xs text-foreground-muted">
      <div className="flex items-center gap-1.5 font-medium text-foreground">
        <Bot className="w-4 h-4 text-primary" />
        <span>AI-Assisted Synthesis</span>
      </div>
      <span>•</span>
      <span>
        Researched & drafted using {provider ? `${provider} (${model || 'LLM'})` : 'frontier AI'}, fact-checked against real primary sources.
      </span>
      <Link
        href="/ai-disclosure"
        className="inline-flex items-center gap-1 text-primary hover:underline underline-offset-2 ml-auto font-medium"
      >
        <HelpCircle className="w-3.5 h-3.5" />
        <span>Our Ethics & Verification Policy</span>
      </Link>
    </div>
  );
}
