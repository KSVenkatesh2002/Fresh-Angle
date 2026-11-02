import React from "react";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import {
  LayoutDashboard,
  FileText,
  PlusCircle,
  Cpu,
  CalendarClock,
  BarChart3,
  Rss,
  Tags,
  MessageSquare,
  SearchCheck,
  Settings,
  History,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { siteConfig } from "@/config/site";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { title: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { title: "Posts", href: "/admin/posts", icon: FileText },
  { title: "New Post", href: "/admin/posts/new", icon: PlusCircle },
  { title: "Automation", href: "/admin/automation", icon: Cpu },
  { title: "Schedule & Queue", href: "/admin/schedule", icon: CalendarClock },
  { title: "Usage & Quotas", href: "/admin/usage", icon: BarChart3 },
  { title: "Feeds", href: "/admin/feeds", icon: Rss },
  { title: "Categories & Tags", href: "/admin/categories", icon: Tags },
  { title: "SEO Tools", href: "/admin/seo", icon: SearchCheck },
  { title: "Messages", href: "/admin/messages", icon: MessageSquare },
  { title: "Settings", href: "/admin/settings", icon: Settings },
  { title: "Pipeline Runs", href: "/admin/runs", icon: History },
  { title: "Audit Log", href: "/admin/audit", icon: ShieldCheck },
];

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
              <div className="w-6 h-6 rounded bg-primary text-primary-foreground flex items-center justify-center text-xs">
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
        <div className="px-4 sm:px-6 overflow-x-auto border-t border-border/50 flex items-center gap-1 py-1.5 scrollbar-none text-xs font-medium text-foreground-muted">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="px-2.5 py-1.5 rounded-lg hover:text-foreground hover:bg-surface-muted flex items-center gap-1.5 whitespace-nowrap transition-colors"
              >
                <Icon className="w-3.5 h-3.5 text-primary" />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </div>
      </header>

      {/* Main Admin Content */}
      <main className="flex-1 py-6">
        <Container>{children}</Container>
      </main>
    </div>
  );
}
