'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

export function HeaderSearch(): React.JSX.Element {
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        router.push('/search');
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  return (
    <button
      type="button"
      onClick={() => router.push('/search')}
      aria-label="Search articles (Cmd+K)"
      className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-muted text-foreground-muted hover:text-foreground text-xs font-medium transition-colors"
    >
      <Search className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">Search</span>
      <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] rounded bg-surface-muted border border-border text-foreground-muted">
        ⌘K
      </kbd>
    </button>
  );
}
