import React from 'react';
import type { Metadata } from 'next';
import { Container } from '@/components/layout/Container';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';
import { constructPageMetadata } from '@/lib/seo/metadata';
import { ShieldCheck } from 'lucide-react';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = constructPageMetadata({
  title: 'Privacy Policy',
  description: 'Understand how Fresh Angle respects reader privacy, data security, and cookies.',
  path: '/privacy-policy',
});

export default function PrivacyPolicyPage(): React.JSX.Element {
  return (
    <main className="py-8 sm:py-12">
      <Container size="narrow">
        <Breadcrumbs items={[{ name: 'Privacy Policy', url: '/privacy-policy' }]} />

        <div className="py-6 border-b border-border mb-8">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary mb-2 block">
            Legal & Compliance
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground mb-3">
            Privacy Policy
          </h1>
          <p className="text-foreground-muted text-sm">
            Effective Date: November 1, 2026 • Last Reviewed: Today
          </p>
        </div>

        <div className="space-y-8 text-foreground-muted text-base leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-success" />
              <span>1. Zero Intrusive Tracking</span>
            </h2>
            <p className="leading-7">
              {siteConfig.name} does not employ cross-site tracking scripts, third-party advertising cookies, or fingerprinting pixels. We believe technical journalism should be readable without surveillance.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              2. Technical Cookies & Local Storage
            </h2>
            <p className="leading-7">
              We utilize browser <code className="text-primary font-mono text-sm">localStorage</code> strictly to persist your preferred color theme (<code className="text-primary font-mono text-sm">light</code> or <code className="text-primary font-mono text-sm">dark</code>). For authenticated administrative users, an encrypted session cookie (<code className="text-primary font-mono text-sm">freshangle_session</code>) is stored with httpOnly and Secure attributes.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              3. Server Logs and Caching
            </h2>
            <p className="leading-7">
              Standard edge infrastructure (Vercel) records generic request metadata (IP address, user agent, request path) strictly for operational debugging, DDoS mitigation, and Core Web Vitals telemetry. These logs are routinely cycled and never linked to personal identities.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              4. Third-Party Links
            </h2>
            <p className="leading-7">
              Our articles cite primary research papers, preprint archives, and official technical announcements. We are not responsible for the privacy policies of external sites linked in our references.
            </p>
          </section>
        </div>
      </Container>
    </main>
  );
}
