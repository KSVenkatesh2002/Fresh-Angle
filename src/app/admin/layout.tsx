import React from "react";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { AdminNav } from "@/components/admin/AdminNav";
import { ExternalLink, LogOut } from "lucide-react";
import { siteConfig } from "@/config/site";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({
  children,
}: AdminLayoutProps): React.JSX.Element {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Admin Mission Control Header */}
      <header className="border-b border-border bg-surface sticky top-0 z-40 backdrop-blur-md">
        <div className="px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="font-bold text-sm sm:text-base tracking-tight text-foreground flex items-center gap-2.5"
            >
              <div className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-xs font-black shadow-sm">
                FA
              </div>
              <span className="font-extrabold">{siteConfig.name}</span>
              <span className="text-foreground-muted font-normal text-xs sm:text-sm">
                Mission Control
              </span>
            </Link>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-success/10 text-success border border-success/20">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span>Live System</span>
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 text-xs">
            <ThemeToggle />
            <Link
              href="/"
              target="_blank"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-muted text-foreground-muted hover:text-foreground transition-colors font-medium text-xs"
            >
              <span>View Public Site</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
            <form action="/api/admin/logout" method="POST">
              <button
                type="submit"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-surface hover:bg-danger/10 hover:text-danger hover:border-danger/30 text-foreground-muted transition-colors font-medium text-xs cursor-pointer"
                title="Sign out of Mission Control"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </form>
          </div>
        </div>

        {/* Modern Categorized Domain Navigation Bar */}
        <AdminNav />
      </header>

      {/* Main Admin Content */}
      <main className="flex-1 py-6">
        <Container>{children}</Container>
      </main>
    </div>
  );
}

