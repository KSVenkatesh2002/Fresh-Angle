import React from "react";
import Link from "next/link";
import Image from "next/image";
import { siteConfig } from "@/config/site";
import { Container } from "./Container";
import { Sparkles, ExternalLink, Send } from "lucide-react";
import { getDisplaySettings } from "@/services/settings/display";

export async function Footer(): Promise<React.JSX.Element> {
  const currentYear = new Date().getFullYear();
  const displaySettings = await getDisplaySettings().catch(() => ({
    showDeveloperFooter: false,
    showTelegramJoin: true,
    telegramChannelUrl: "https://t.me/freshangle_blog",
  }));

  const telegramUrl =
    displaySettings.telegramChannelUrl?.trim() || "https://t.me/freshangle_blog";

  return (
    <footer className="w-full border-t border-border bg-surface-muted/50 mt-20 transition-colors">
      <Container>
        {/* Telegram Community Join Banner (Conditional via Admin Toggle) */}
        {displaySettings.showTelegramJoin && (
          <div className="pt-10 pb-4 border-b border-border/60">
            <div className="p-6 rounded-2xl bg-surface border border-border shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-5">
              <div className="flex items-start sm:items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                  <Send className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-foreground">
                      Join Fresh Angle on Telegram
                    </h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      Community
                    </span>
                  </div>
                  <p className="text-xs text-foreground-muted max-w-xl">
                    Get real-time breaking tech dispatches, frontier AI papers, and publication alerts delivered directly to your Telegram feed.
                  </p>
                </div>
              </div>
              <a
                href={telegramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity shrink-0 shadow-sm"
              >
                <Send className="w-4 h-4" />
                <span>Join Telegram Channel</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}

        <div className="py-12 md:py-16 grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand & Creator Profile */}
          <div className="md:col-span-2 space-y-4">
            <Link
              href="/"
              className="flex items-center gap-2 font-bold text-lg text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              <div className="w-7 h-7 rounded bg-primary flex items-center justify-center text-primary-foreground">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <span>{siteConfig.name}</span>
            </Link>
            <p className="text-sm text-foreground-muted leading-relaxed max-w-md">
              {siteConfig.description}
            </p>

            {/* Creator Profile Card (Conditional via Admin Toggle) */}
            {siteConfig.creator && displaySettings.showDeveloperFooter && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-2xl bg-surface border border-border max-w-lg shadow-sm hover:border-primary/50 transition-colors">
                <a
                  href={siteConfig.creator.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden shrink-0 border border-border group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring block"
                  style={{ width: "80px", height: "80px" }}
                  title={`View ${siteConfig.creator.name}'s profile`}
                >
                  <Image
                    src={siteConfig.creator.image}
                    alt={`Photo of ${siteConfig.creator.name}`}
                    width={96}
                    height={96}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-background/0 group-hover:bg-background/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <ExternalLink className="w-4 h-4 text-primary drop-shadow" />
                  </div>
                </a>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="text-[11px] font-semibold tracking-wider uppercase text-primary">
                    Site Architecture & Systems
                  </div>
                  <a
                    href={siteConfig.creator.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-base font-bold text-foreground hover:text-primary inline-flex items-center gap-1.5 transition-colors"
                  >
                    <span>{siteConfig.creator.name}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-foreground-muted" />
                  </a>
                  <p className="text-xs text-foreground-muted leading-relaxed line-clamp-2">
                    {siteConfig.creator.bio ||
                      "Full-Stack Systems Engineer & AI Solutions Architect."}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Explore
            </h2>
            <ul className="space-y-2 text-sm text-foreground-muted">
              {siteConfig.footerLinks.navigation.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                  >
                    {link.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal & Compliance */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Ethics & Legal
            </h2>
            <ul className="space-y-2 text-sm text-foreground-muted">
              {siteConfig.footerLinks.legal.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                  >
                    {link.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="py-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-foreground-muted">
          <p>
            © {currentYear} {siteConfig.name}. All rights reserved.
          </p>
          <p className="flex items-center gap-1.5">
            Designed for high-speed indexing, semantic clarity & zero filler.
          </p>
        </div>
      </Container>
    </footer>
  );
}
