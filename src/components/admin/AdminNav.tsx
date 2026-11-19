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
    <div className="px-4 sm:px-6 overflow-x-auto border-t border-border/50 flex items-center gap-1.5 py-1.5 scrollbar-none text-xs font-medium">
      {NAV_GROUPS.map((group, groupIdx) => (
        <React.Fragment key={group.label}>
          {groupIdx > 0 && (
            <div
              className="h-4 w-px bg-border/60 mx-1 shrink-0"
              aria-hidden="true"
            />
          )}
          <div className="flex items-center gap-1 shrink-0">
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
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                      : "text-foreground-muted hover:text-foreground hover:bg-surface-muted"
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      isActive ? "text-primary-foreground" : "text-primary"
                    }`}
                  />
                  <span>{item.title}</span>
                </Link>
              );
            })}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

