import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getTagsWithCounts } from '@/db/queries/tags';
import { Container } from '@/components/layout/Container';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';
import { JsonLd } from '@/components/seo/JsonLd';
import { constructPageMetadata } from '@/lib/seo/metadata';
import { generateCollectionJsonLd } from '@/lib/seo/jsonld';
import { siteConfig } from '@/config/site';
import { Hash } from 'lucide-react';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return constructPageMetadata({
    title: 'Topic Tags & Entities',
    description: `Explore all indexing tags, technical entities, and research topics tracked across ${siteConfig.name}.`,
    path: '/tags',
  });
}

export default async function TagsIndexPage(): Promise<React.JSX.Element> {
  const tagsList = await getTagsWithCounts();
  const collectionJsonLd = generateCollectionJsonLd(
    'Topic Tags & Entities',
    `Explore all indexing tags, technical entities, and research topics on ${siteConfig.name}.`,
    '/tags'
  );

  return (
    <main className="py-8 sm:py-12">
      <JsonLd data={collectionJsonLd} />
      <Container>
        <Breadcrumbs items={[{ name: 'Tags', url: '/tags' }]} />

        <div className="py-6 border-b border-border mb-10">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary mb-2 block">
            Ontology & Indexing
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground mb-3">
            All Topic Tags
          </h1>
          <p className="text-foreground-muted text-base max-w-2xl leading-relaxed">
            Granular technical concepts, benchmark suites, foundation models, and hardware architectures analyzed across our dispatches.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {tagsList.map((tag) => (
            <Link
              key={tag.id}
              href={`/tag/${tag.slug}`}
              className="group inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface border border-border hover:border-primary/50 transition-all text-sm font-medium text-foreground hover:bg-surface-muted"
            >
              <Hash className="w-3.5 h-3.5 text-primary group-hover:scale-110 transition-transform" />
              <span>{tag.name}</span>
              <span className="px-1.5 py-0.5 rounded-md bg-surface-muted border border-border text-[11px] text-foreground-muted group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                {tag.postCount}
              </span>
            </Link>
          ))}
        </div>
      </Container>
    </main>
  );
}
