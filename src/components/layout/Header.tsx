import React from "react";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { Container } from "./Container";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { HeaderSearch } from "./HeaderSearch";
import { MobileNav } from "./MobileNav";
import { Sparkles, Rss, Send } from "lucide-react";
import { getDisplaySettings } from "@/services/settings/display";

export async function Header(): Promise<React.JSX.Element> {
  const displaySettings = await getDisplaySettings().catch(() => ({
    showTelegramJoin: true,
    telegramChannelUrl: "https://t.me/freshangle_blog",
  }));

  const telegramUrl =
    displaySettings.telegramChannelUrl?.trim() || "https://t.me/freshangle_blog";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-surface/85 backdrop-blur-md transition-colors">
      <Container>
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo & Brand */}
          <Link
            href="/"
            className="flex items-center gap-2.5 font-bold text-lg tracking-tight text-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg px-1"
          >
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="leading-tight">{siteConfig.name}</span>
              <span className="text-[10px] font-medium tracking-wider uppercase text-foreground-muted">
                AI & Tech Intel
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav
            aria-label="Main Navigation"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-foreground-muted"
          >
            {siteConfig.navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="hover:text-foreground transition-colors py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                {link.title}
              </Link>
            ))}
          </nav>

          {/* Action Tools */}
          <div className="flex items-center gap-2">
            <HeaderSearch />

            {displaySettings.showTelegramJoin && (
              <>
                <a
                  href={telegramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Join Telegram Channel"
                  title="Join Telegram Channel"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Join Telegram</span>
                </a>
                <a
                  href={telegramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Join Telegram Channel"
                  title="Join Telegram Channel"
                  className="sm:hidden w-9 h-9 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Send className="w-4 h-4" />
                </a>
              </>
            )}

            <Link
              href="/feed.xml"
              target="_blank"
              rel="alternate"
              type="application/rss+xml"
              aria-label="RSS Feed"
              className="w-9 h-9 rounded-lg border border-border bg-surface hover:bg-surface-muted text-foreground flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Rss className="w-4 h-4" />
            </Link>

            <ThemeToggle />

            <MobileNav
              navLinks={siteConfig.navLinks}
              telegramUrl={displaySettings.showTelegramJoin ? telegramUrl : undefined}
            />
          </div>
        </div>
      </Container>
    </header>
  );
}
