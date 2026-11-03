import React from "react";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { AdminNav } from "@/components/admin/AdminNav";
import { ExternalLink } from "lucide-react";
import { siteConfig } from "@/config/site";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({
  children,
}: AdminLayoutProps): React.JSX.Element {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Admin Header */}
      <header className="border-b border-border bg-surface sticky top-0 z-40">
        <div className="px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="font-bold text-base tracking-tight text-foreground flex items-center gap-2"
            >
              <div className="w-6 h-6 rounded bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                FA
              </div>
              <span>{siteConfig.name} Mission Control</span>
            </Link>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <Link
              href="/"
              target="_blank"
              className="inline-flex items-center gap-1 text-foreground-muted hover:text-foreground transition-colors"
            >
              <span>View Public Site</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
            <form action="/api/admin/logout" method="POST">
              <button
                type="submit"
                className="px-2.5 py-1 rounded border border-border bg-surface hover:bg-surface-muted text-foreground-muted hover:text-foreground transition-colors"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>

        {/* Navigation Bar / Tabs */}
        <AdminNav />
      </header>

      {/* Main Admin Content */}
      <main className="flex-1 py-6">
        <Container>{children}</Container>
      </main>
    </div>
  );
}
