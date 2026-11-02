import React from "react";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { BreadcrumbItem, generateBreadcrumbJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "./JsonLd";

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps): React.JSX.Element {
  const jsonLdData = generateBreadcrumbJsonLd([
    { name: "Home", url: "/" },
    ...items,
  ]);

  return (
    <>
      <JsonLd data={jsonLdData} />
      <nav aria-label="Breadcrumb" className="my-4">
        <ol className="flex flex-wrap items-center gap-1.5 text-xs text-foreground-muted">
          <li>
            <Link
              href="/"
              className="inline-flex items-center gap-1 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              aria-label="Home"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Home</span>
            </Link>
          </li>

          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            return (
              <li key={item.url} className="flex items-center gap-1.5">
                <ChevronRight
                  className="w-3 h-3 opacity-50"
                  aria-hidden="true"
                />
                {isLast ? (
                  <span
                    className="font-medium text-foreground max-w-[200px] sm:max-w-xs truncate"
                    aria-current="page"
                  >
                    {item.name}
                  </span>
                ) : (
                  <Link
                    href={item.url}
                    className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                  >
                    {item.name}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
