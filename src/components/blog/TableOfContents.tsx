"use client";

import React, { useEffect, useState } from "react";
import { TocItem } from "@/lib/markdown/toc";
import { List, ChevronDown } from "lucide-react";

interface TableOfContentsProps {
  items: TocItem[];
  variant?: "inline" | "sidebar";
}

export function TableOfContents({
  items,
  variant = "sidebar",
}: TableOfContentsProps): React.JSX.Element | null {
  const [activeId, setActiveId] = useState<string>("");
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    if (items.length === 0) return;

    const headingElements = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);

    if (headingElements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find visible heading nearest the top
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      {
        rootMargin: "-80px 0px -60% 0px",
        threshold: [0, 1.0],
      },
    );

    headingElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  // Responsive Mobile Collapsible Card (shown on mobile/tablet)
  if (variant === "inline") {
    return (
      <nav
        aria-label="Table of Contents (Mobile)"
        className="xl:hidden my-6 rounded-2xl border border-border bg-surface shadow-sm overflow-hidden"
      >
        <button
          type="button"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="w-full flex items-center justify-between p-4 text-left font-medium text-foreground hover:bg-surface-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={isMobileOpen}
        >
          <div className="flex items-center gap-2.5">
            <List className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold tracking-wide">
              Table of Contents
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-surface-muted border border-border text-foreground-muted">
              {items.length}
            </span>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-foreground-muted transition-transform duration-200 ${
              isMobileOpen ? "rotate-180 text-primary" : ""
            }`}
          />
        </button>

        {isMobileOpen && (
          <div className="px-4 pb-4 pt-1 border-t border-border">
            <ul className="space-y-1 text-sm pt-2">
              {items.map((item) => {
                const isActive = activeId === item.id;
                return (
                  <li
                    key={item.id}
                    className={item.level === 3 ? "pl-4 text-xs" : ""}
                  >
                    <a
                      href={`#${item.id}`}
                      onClick={() => setIsMobileOpen(false)}
                      className={`block py-1.5 px-2.5 rounded-lg transition-colors ${
                        isActive
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-foreground-muted hover:text-foreground hover:bg-surface-muted"
                      }`}
                    >
                      {item.text}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </nav>
    );
  }

  // Desktop Sticky Sidebar Widget (shown on xl+ screens)
  return (
    <aside
      aria-label="Table of Contents (Desktop)"
      className="hidden xl:block w-72 shrink-0 sticky top-24 self-start max-h-[calc(100vh-7rem)] overflow-y-auto pr-2"
    >
      <div className="p-5 rounded-2xl border border-border bg-surface/90 backdrop-blur-sm shadow-sm">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
          <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center text-primary">
            <List className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
            On This Page
          </h2>
        </div>

        <ul className="space-y-1 text-xs">
          {items.map((item) => {
            const isActive = activeId === item.id;
            return (
              <li
                key={item.id}
                className={item.level === 3 ? "pl-3.5" : ""}
              >
                <a
                  href={`#${item.id}`}
                  className={`block py-1.5 px-2.5 rounded-lg transition-all duration-150 leading-relaxed ${
                    isActive
                      ? "bg-primary/10 text-primary font-bold border-l-2 border-primary -ml-[1px]"
                      : "text-foreground-muted hover:text-foreground hover:bg-surface-muted"
                  }`}
                >
                  {item.text}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
