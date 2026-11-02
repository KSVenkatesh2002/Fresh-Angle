import React from 'react';
import type { Metadata } from 'next';
import { Container } from '@/components/layout/Container';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';
import { ContactForm } from '@/components/ui/ContactForm';
import { constructPageMetadata } from '@/lib/seo/metadata';
import { Mail, MessageSquare } from 'lucide-react';
import { siteConfig } from '@/config/site';


export const metadata: Metadata = constructPageMetadata({
  title: 'Contact Fresh Angle Editorial',
  description: 'Reach out to the Fresh Angle team for corrections, research submissions, or inquiries.',
  path: '/contact',
});

export default function ContactPage(): React.JSX.Element {
  return (
    <main className="py-8 sm:py-12">
      <Container size="narrow">
        <Breadcrumbs items={[{ name: 'Contact', url: '/contact' }]} />

        <div className="py-6 border-b border-border mb-8">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary mb-2 block">
            Get In Touch
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground mb-3">
            Contact Editorial Team
          </h1>
          <p className="text-foreground-muted text-base max-w-xl leading-relaxed">
            Have a correction, feedback on our synthesis, or a research paper you would like our autonomous pipeline to ingest?
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 p-6 sm:p-8 rounded-2xl bg-surface border border-border shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              <span>Send a Message</span>
            </h2>
            <ContactForm />
          </div>


          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-surface-muted border border-border">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground mb-3 flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" />
                <span>Direct Inquiries</span>
              </h2>
              <p className="text-xs text-foreground-muted leading-relaxed mb-4">
                For security vulnerabilities, copyright notices, or developer partnership inquiries:
              </p>
              <p className="text-sm font-medium text-primary">
                contact@{siteConfig.url.replace(/^https?:\/\//, '')}
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-surface-muted border border-border text-xs text-foreground-muted space-y-2">
              <h3 className="font-semibold text-foreground">Automated Processing</h3>
              <p className="leading-relaxed">
                Submitted research papers and corrections are reviewed during daily scheduled ingest cycles.
              </p>
            </div>
          </div>
        </div>
      </Container>
    </main>
  );
}
