import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getArchiveMonths } from "@/db/queries/posts";
import { Container } from "@/components/layout/Container";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { constructPageMetadata } from "@/lib/seo/metadata";
import { generateCollectionJsonLd } from "@/lib/seo/jsonld";
import { siteConfig } from "@/config/site";
import { Calendar, ArrowRight } from "lucide-react";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return constructPageMetadata({
    title: "Dispatches Chronological Archive",
    description: `Chronological archive of all daily technical dispatches published on ${siteConfig.name}.`,
    path: "/archive",
  });
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default async function ArchiveIndexPage(): Promise<React.JSX.Element> {
  const months = await getArchiveMonths();
  const collectionJsonLd = generateCollectionJsonLd(
    "Dispatches Chronological Archive",
    `Chronological archive of all daily technical dispatches on ${siteConfig.name}.`,
    "/archive",
  );

  return (
    <main className="py-8 sm:py-12">
      <JsonLd data={collectionJsonLd} />
      <Container>
        <Breadcrumbs items={[{ name: "Archive", url: "/archive" }]} />

        <div className="py-6 border-b border-border mb-10">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary mb-2 block">
            Chronology
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground mb-3">
            Monthly Publication Archive
          </h1>
          <p className="text-foreground-muted text-base max-w-2xl leading-relaxed">
            Historical record of all AI intelligence briefings, model
            breakdowns, and benchmark reviews published by date.
          </p>
        </div>

        {months.length === 0 ? (
          <div className="p-8 rounded-2xl bg-surface border border-border text-center text-foreground-muted text-sm">
            No published dispatches recorded in the archive yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {months.map(({ year, month, count }) => {
              const monthStr = String(month).padStart(2, "0");
              const monthName = MONTH_NAMES[month - 1] || `Month ${month}`;
              return (
                <Link
                  key={`${year}-${month}`}
                  href={`/archive/${year}/${monthStr}`}
                  className="group p-5 rounded-2xl bg-surface border border-border hover:border-primary/50 transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-surface-muted border border-border flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                        {monthName} {year}
                      </h2>
                      <span className="text-xs text-foreground-muted">
                        {count} {count === 1 ? "Dispatch" : "Dispatches"}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/60 flex items-center justify-end text-xs text-primary font-medium">
                    <span className="inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      View month
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Container>
    </main>
  );
}
