"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavLink } from "@/config/site";
import { Menu, X, ChevronRight } from "lucide-react";

interface MobileNavProps {
  navLinks: readonly NavLink[];
}

export function MobileNav({ navLinks }: MobileNavProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Close menu when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Close menu on Escape key press
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={isOpen}
        aria-controls="mobile-navigation-drawer"
        className="w-9 h-9 rounded-lg border border-border bg-surface hover:bg-surface-muted text-foreground flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {isOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
      </button>

      {isOpen && (
        <div
          id="mobile-navigation-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation"
          className="fixed inset-x-0 top-16 bottom-0 z-[100] bg-background border-b border-border p-6 overflow-y-auto shadow-2xl"
        >
          <nav aria-label="Mobile Navigation Links" className="space-y-1.5">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl text-base font-semibold transition-colors ${
                    isActive
                      ? "bg-surface text-primary border border-border"
                      : "text-foreground hover:bg-surface-muted hover:text-foreground"
                  }`}
                >
                  <span>{link.title}</span>
                  <ChevronRight
                    className={`w-4 h-4 ${isActive ? "text-primary" : "text-foreground-muted"}`}
                  />
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </div>
  );
}
