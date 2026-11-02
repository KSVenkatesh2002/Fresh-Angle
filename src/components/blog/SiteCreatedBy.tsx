import React from 'react';
import Image from 'next/image';
import { siteConfig } from '@/config/site';
import { ExternalLink, Code } from 'lucide-react';

export function SiteCreatedBy(): React.JSX.Element {
  return (
    <div className="my-10 p-5 rounded-2xl bg-surface border border-border flex flex-col sm:flex-row items-center sm:items-start gap-4">
      <div className="relative w-14 h-14 rounded-full overflow-hidden shrink-0 border border-border">
        <Image
          src={siteConfig.creator.image}
          alt={`Photo of ${siteConfig.creator.name}`}
          fill
          sizes="56px"
          className="object-cover"
        />
      </div>
      <div className="flex-1 text-center sm:text-left space-y-1">
        <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs text-foreground-muted">
          <Code className="w-3.5 h-3.5 text-primary" />
          <span>Site Architecture & Engineering</span>
        </div>
        <p className="text-sm font-semibold text-foreground">
          Created by{' '}
          <a
            href={siteConfig.creator.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            <span>{siteConfig.creator.name}</span>
            <ExternalLink className="w-3 h-3 text-foreground-muted" />
          </a>
        </p>
        <p className="text-xs text-foreground-muted leading-relaxed">
          This publication is an autonomous AI research demonstration engineered by Venkatesh K S. Dispatches are synthesized by the editorial AI engine based on verified primary sources.
        </p>
      </div>
    </div>
  );
}
