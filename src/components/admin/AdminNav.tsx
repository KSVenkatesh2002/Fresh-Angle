"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  LucideIcon,
} from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Editorial",
    items: [
      { title: "Dashboard", href: "/admin", icon: LayoutDashboard, exact: true },
      { title: "Posts", href: "/admin/posts", icon: FileText, exact: true },
      { title: "New Post", href: "/admin/posts/new", icon: PlusCircle },
      { title: "Categories & Tags", href: "/admin/categories", icon: Tags },
    ],
  },
  {
    label: "Automation",
    items: [
      { title: "Automation", href: "/admin/automation", icon: Cpu },
      { title: "Pipeline Runs", href: "/admin/runs", icon: History },
      { title: "Schedule & Queue", href: "/admin/schedule", icon: CalendarClock },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { title: "Feeds", href: "/admin/feeds", icon: Rss },
      { title: "SEO Tools", href: "/admin/seo", icon: SearchCheck },
      { title: "Usage & Quotas", href: "/admin/usage", icon: BarChart3 },
      { title: "Messages", href: "/admin/messages", icon: MessageSquare },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Audit Log", href: "/admin/audit", icon: ShieldCheck },
      { title: "Settings", href: "/admin/settings", icon: Settings },
    ],
  },
];

export function AdminNav(): React.JSX.Element {
  const pathname = usePathname();

  return (
    <div className="px-4 sm:px-6 py-2 overflow-x-auto border-t border-border/60 bg-surface-muted/30 scrollbar-none">
      <div className="flex items-center gap-2.5 min-w-max">
        {NAV_GROUPS.map((group) => {
          const isGroupActive = group.items.some((item) =>
            item.exact
              ? pathname === item.href
              : pathname === item.href || pathname?.startsWith(`${item.href}/`),
          );

          return (
            <div
              key={group.label}
              className={`flex items-center gap-1 p-1 rounded-xl border transition-all ${
                isGroupActive
                  ? "bg-surface border-primary/30 shadow-xs"
                  : "bg-surface/60 border-border/70 hover:bg-surface"
              }`}
            >
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 select-none ${
                  isGroupActive ? "text-primary" : "text-foreground-muted"
                }`}
              >
                {group.label}
              </span>

              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname?.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 text-xs whitespace-nowrap transition-all ${
                      isActive
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                        : "text-foreground-muted hover:text-foreground hover:bg-surface-muted font-medium"
                    }`}
                  >
                    <Icon
                      className={`w-3.5 h-3.5 ${
                        isActive ? "text-primary-foreground" : "text-primary/70"
                      }`}
                    />
                    <span>{item.title}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

