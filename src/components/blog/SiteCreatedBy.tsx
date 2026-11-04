import React from "react";
import Image from "next/image";
import { siteConfig } from "@/config/site";
import { ExternalLink, Code } from "lucide-react";

export function SiteCreatedBy(): React.JSX.Element | null {
  if (!siteConfig.creator) return null;
  const creator = siteConfig.creator;

  return (
    <div className="my-10 p-5 rounded-2xl bg-surface border border-border flex flex-col sm:flex-row items-center sm:items-start gap-5 shadow-sm hover:border-primary/40 transition-colors">
      <a
        href={creator.url}
        target="_blank"
        rel="noopener noreferrer"
        className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden shrink-0 border border-border group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring block"
        style={{ width: "80px", height: "80px" }}
        title={`View ${creator.name}'s profile`}
      >
        <Image
          src={creator.image}
          alt={`Photo of ${creator.name}`}
          width={96}
          height={96}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-background/0 group-hover:bg-background/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <ExternalLink className="w-4 h-4 text-primary drop-shadow" />
        </div>
      </a>
      <div className="flex-1 text-center sm:text-left space-y-1.5">
        <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
          <Code className="w-3.5 h-3.5" />
          <span>Site Architecture & Engineering</span>
        </div>
        <p className="text-base font-bold text-foreground">
          Created by{" "}
          <a
            href={creator.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            <span>{creator.name}</span>
            <ExternalLink className="w-3.5 h-3.5 text-foreground-muted" />
          </a>
        </p>
        <p className="text-xs text-foreground-muted leading-relaxed">
          This publication is an autonomous AI research demonstration engineered
          by {creator.name}. Dispatches are synthesized by the editorial AI
          engine based on verified primary sources.
        </p>
      </div>
    </div>
  );
}
