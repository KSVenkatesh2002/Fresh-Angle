"use client";

import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { TocItem } from "@/lib/markdown/toc";
import { List, ChevronDown, X } from "lucide-react";

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
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const inlineNavRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // IntersectionObserver to highlight active heading on scroll
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

  // Track scroll position to reveal floating top-right button when scrolled down
  useEffect(() => {
    if (variant !== "inline") return;

    function handleScroll(): void {
      if (inlineNavRef.current) {
        const rect = inlineNavRef.current.getBoundingClientRect();
        // Show floating button once the inline TOC scrolls past top of viewport
        setIsScrolled(rect.bottom < 80);
      } else {
        setIsScrolled(window.scrollY > 300);
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, [variant]);

  // Close popup dialog on Escape key and prevent body scroll when open
  useEffect(() => {
    if (!isPopupOpen) return;

    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        setIsPopupOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isPopupOpen]);

  if (items.length === 0) return null;

  const handleHeadingClick = (id: string) => {
    setIsPopupOpen(false);
    setIsMobileOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      window.history.replaceState(null, "", `#${id}`);
    }
  };

  // Responsive Mobile Collapsible Card + Floating Top-Right Popup
  if (variant === "inline") {
    const popupDialogContent = isPopupOpen && mounted ? (
      <div className="fixed inset-0 z-50 xl:hidden">
        {/* Backdrop overlay */}
        <div
          className="fixed inset-0 bg-background/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          onClick={() => setIsPopupOpen(false)}
          aria-hidden="true"
        />

        {/* Floating Popup Card Anchored at Top Right */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Table of Contents"
          className="fixed top-20 right-4 left-4 sm:left-auto sm:w-80 max-h-[calc(100vh-6.5rem)] rounded-2xl border border-border bg-surface/98 backdrop-blur-md shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        >
          {/* Popup Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-surface-muted/30">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <List className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground leading-tight">
                  Table of Contents
                </h2>
                <p className="text-[11px] text-foreground-muted">
                  {items.length} sections in this dispatch
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsPopupOpen(false)}
              aria-label="Close Table of Contents"
              className="w-8 h-8 rounded-lg border border-border bg-surface hover:bg-surface-muted text-foreground-muted hover:text-foreground flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable Heading List */}
          <div className="overflow-y-auto p-3 space-y-1">
            {items.map((item) => {
              const isActive = activeId === item.id;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    handleHeadingClick(item.id);
                  }}
                  className={`block py-2 px-3 rounded-xl transition-all duration-150 leading-relaxed text-xs ${
                    item.level === 3 ? "pl-6 text-[11px]" : "font-medium"
                  } ${
                    isActive
                      ? "bg-primary/10 text-primary font-bold border-l-2 border-primary"
                      : "text-foreground-muted hover:text-foreground hover:bg-surface-muted"
                  }`}
                >
                  {item.text}
                </a>
              );
            })}
          </div>
        </div>
      </div>
    ) : null;

    return (
      <>
        {/* Inline Card at Top of Post */}
        <nav
          ref={inlineNavRef}
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
                        onClick={(e) => {
                          e.preventDefault();
                          handleHeadingClick(item.id);
                        }}
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

        {/* Floating Top-Right Icon Box (Visible when scrolled down) */}
        <div
          className={`fixed top-[4.75rem] right-4 z-40 xl:hidden transition-all duration-300 ${
            isScrolled
              ? "opacity-100 translate-y-0 pointer-events-auto scale-100"
              : "opacity-0 -translate-y-2 pointer-events-none scale-90"
          }`}
        >
          <button
            type="button"
            onClick={() => setIsPopupOpen(!isPopupOpen)}
            aria-label={isPopupOpen ? "Close Table of Contents" : "Open Table of Contents"}
            aria-expanded={isPopupOpen}
            title="Table of Contents"
            className="w-11 h-11 rounded-2xl border border-border bg-surface/90 backdrop-blur-md shadow-lg hover:shadow-xl flex items-center justify-center text-foreground hover:text-primary transition-all active:scale-95 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <List className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
            <span className="sr-only">Table of Contents</span>
            {/* Pill with count */}
            <span className="absolute -top-1 -right-1 min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shadow-xs">
              {items.length}
            </span>
          </button>
        </div>

        {/* Render Popup in Portal */}
        {mounted && typeof document !== "undefined" && createPortal(popupDialogContent, document.body)}
      </>
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
