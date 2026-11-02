import React from 'react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';
import { JsonLd } from '@/components/seo/JsonLd';
import { constructPageMetadata } from '@/lib/seo/metadata';
import { generatePersonJsonLd } from '@/lib/seo/jsonld';
import { Sparkles, Cpu, CheckCircle2, ShieldAlert, ExternalLink, Code } from 'lucide-react';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = constructPageMetadata({
  title: 'About Fresh Angle - Autonomous AI Journalism',
  description:
    'Learn how Fresh Angle autonomously discovers, fact-checks, and publishes daily analytical briefings on artificial intelligence.',
  path: '/about',
});

export default function AboutPage(): React.JSX.Element {
  return (
    <main className="py-8 sm:py-12">
      <JsonLd data={generatePersonJsonLd()} />
      <Container size="narrow">
        <Breadcrumbs items={[{ name: 'About', url: '/about' }]} />

        <div className="py-6 border-b border-border mb-10">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary mb-2 block">
            Our Mission & Architecture
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground mb-4">
            Autonomous, Fact-Grounded AI Journalism
          </h1>
          <p className="text-foreground-muted text-lg leading-relaxed">
            {siteConfig.description}
          </p>
        </div>

        <div className="space-y-12 text-foreground text-base leading-relaxed">
          <section className="space-y-4">
            <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <span>Why Fresh Angle Exists</span>
            </h2>
            <p className="text-foreground-muted leading-7">
              The velocity of artificial intelligence development has outpaced traditional newsrooms. Between ArXiv preprints, benchmark evaluations, model releases, and corporate announcements, discovering what truly matters requires continuous, systematic analysis.
            </p>
            <p className="text-foreground-muted leading-7">
              Fresh Angle was engineered as an autonomous editorial publication that monitors real industry dispatches every hour, selects high-impact developments, extracts verifiable evidence, and synthesizes balanced technical briefings.
            </p>
          </section>

          {/* Creator Profile Section */}
          <section className="p-6 sm:p-8 rounded-2xl bg-surface border border-border space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
              <Code className="w-4 h-4" />
              <span>Architecture & Engineering Leadership</span>
            </div>
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden shrink-0 border-2 border-border shadow-sm">
                <Image
                  src={siteConfig.creator.image}
                  alt={`Photo of ${siteConfig.creator.name}`}
                  fill
                  sizes="112px"
                  className="object-cover"
                />
              </div>
              <div className="space-y-3 text-center sm:text-left">
                <div>
                  <h3 className="text-xl font-bold text-foreground">
                    {siteConfig.creator.name}
                  </h3>
                  <p className="text-xs text-primary font-medium">Founder & Principal Systems Architect</p>
                </div>
                <p className="text-sm text-foreground-muted leading-relaxed">
                  {siteConfig.creator.bio}
                </p>
                <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-4">
                  <a
                    href={siteConfig.creator.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                  >
                    <span>Visit Personal Portfolio</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  {siteConfig.social.github && (
                    <a
                      href={siteConfig.social.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground-muted hover:text-foreground"
                    >
                      <span>GitHub</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4 p-6 sm:p-8 rounded-2xl bg-surface border border-border">
            <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Cpu className="w-5 h-5 text-primary" />
              <span>The Autonomous Editorial Engine</span>
            </h2>
            <p className="text-foreground-muted leading-7">
              Our publication operates entirely via an automated, multi-stage pipeline:
            </p>
            <ul className="space-y-3 pl-2 text-foreground">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
                <span>
                  <strong>Topic Discovery:</strong> Continuous RSS and Hacker News ingestion filtered through strict niche domain relevance algorithms.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
                <span>
                  <strong>Primary Research Extraction:</strong> Web article text extraction with noise elimination.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
                <span>
                  <strong>Multi-Phase LLM Pipeline:</strong> Independent Outline, Drafting, and Editorial Review stages using strict persona constraints and fallback chains.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
                <span>
                  <strong>Strict Fact Grounding:</strong> No statistics or quotes may be fabricated. Every metric must be directly anchored in the verified primary sources.
                </span>
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-warning" />
              <span>Commitment to Transparency</span>
            </h2>
            <p className="text-foreground-muted leading-7">
              Every post on Fresh Angle clearly denotes the AI models utilized during drafting, links directly to the original primary research sources, and provides full transparency into our synthesis process. Read our comprehensive <Link href="/ai-disclosure" className="text-primary hover:underline underline-offset-4 font-medium">AI Disclosure & Ethics Policy</Link>.
            </p>
          </section>
        </div>
      </Container>
    </main>
  );
}
