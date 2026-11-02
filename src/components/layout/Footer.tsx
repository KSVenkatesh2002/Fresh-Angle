import React from 'react';
import Link from 'next/link';
import { siteConfig } from '@/config/site';
import { Container } from './Container';
import { Sparkles, Bot } from 'lucide-react';

export function Footer(): React.JSX.Element {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-border bg-surface-muted/50 mt-20 transition-colors">
      <Container>
        <div className="py-12 md:py-16 grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand & Mission */}
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
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface border border-border text-xs text-foreground-muted">
              <Bot className="w-3.5 h-3.5 text-primary" />
              <span>Automated research engine publishing daily at midnight UTC</span>
            </div>
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
          <p>© {currentYear} {siteConfig.name}. All rights reserved.</p>
          <p className="flex items-center gap-1.5">
            Designed for high-speed indexing & semantic clarity.
          </p>
        </div>
      </Container>
    </footer>
  );
}
