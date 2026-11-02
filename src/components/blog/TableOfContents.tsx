import React from 'react';
import { TocItem } from '@/lib/markdown/toc';
import { List } from 'lucide-react';

interface TableOfContentsProps {
  items: TocItem[];
}

export function TableOfContents({ items }: TableOfContentsProps): React.JSX.Element | null {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Table of Contents"
      className="p-5 rounded-xl border border-border bg-surface shadow-sm my-8"
    >
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
        <List className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
          Table of Contents
        </h2>
      </div>

      <ul className="space-y-2 text-sm">
        {items.map((item) => (
          <li
            key={item.id}
            className={`${item.level === 3 ? 'pl-4 text-xs' : 'font-medium'}`}
          >
            <a
              href={`#${item.id}`}
              className="text-foreground-muted hover:text-primary transition-colors block py-0.5"
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
