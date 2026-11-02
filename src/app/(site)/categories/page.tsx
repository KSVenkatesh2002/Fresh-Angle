import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getCategoriesWithCounts } from '@/db/queries/categories';
import { Container } from '@/components/layout/Container';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';
import { JsonLd } from '@/components/seo/JsonLd';
import { constructPageMetadata } from '@/lib/seo/metadata';
import { generateCollectionJsonLd } from '@/lib/seo/jsonld';
import { siteConfig } from '@/config/site';
import { FolderGit2, ArrowRight } from 'lucide-react';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return constructPageMetadata({
    title: 'Technical Tracks & Categories',
    description: `Explore all specialized research tracks and categories covered on ${siteConfig.name}.`,
    path: '/categories',
  });
}

export default async function CategoriesIndexPage(): Promise<React.JSX.Element> {
  const categoriesList = await getCategoriesWithCounts();
  const collectionJsonLd = generateCollectionJsonLd(
    'Technical Tracks & Categories',
    `Explore all specialized research tracks and categories on ${siteConfig.name}.`,
    '/categories'
  );

  return (
    <main className="py-8 sm:py-12">
      <JsonLd data={collectionJsonLd} />
      <Container>
        <Breadcrumbs items={[{ name: 'Categories', url: '/categories' }]} />

        <div className="py-6 border-b border-border mb-10">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary mb-2 block">
            Domain Architecture
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground mb-3">
            Technical Research Tracks
          </h1>
          <p className="text-foreground-muted text-base max-w-2xl leading-relaxed">
            Curated research streams synthesizing advances in artificial intelligence, model architecture, silicon, and embodied robotics.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categoriesList.map((cat) => (
            <Link
              key={cat.id}
              href={`/category/${cat.slug}`}
              className="group p-6 rounded-2xl bg-surface border border-border hover:border-primary/50 transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2.5">
                <div className="w-10 h-10 rounded-xl bg-surface-muted border border-border flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <FolderGit2 className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                  {cat.name}
                </h2>
                <p className="text-sm text-foreground-muted leading-relaxed line-clamp-3">
                  {cat.description || `In-depth technical coverage and syntheses on ${cat.name}.`}
                </p>
              </div>

              <div className="pt-4 border-t border-border/60 flex items-center justify-between text-xs font-medium text-foreground-muted">
                <span>{cat.postCount} {cat.postCount === 1 ? 'Dispatch' : 'Dispatches'}</span>
                <span className="inline-flex items-center gap-1 text-primary group-hover:translate-x-0.5 transition-transform">
                  Explore track
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </Container>
    </main>
  );
}
