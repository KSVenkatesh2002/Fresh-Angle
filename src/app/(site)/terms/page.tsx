import React from "react";
import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { constructPageMetadata } from "@/lib/seo/metadata";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = constructPageMetadata({
  title: "Terms of Service",
  description: `Terms and conditions governing the use of ${siteConfig.name} and our automated technical dispatches.`,
  path: "/terms",
});

export default function TermsPage(): React.JSX.Element {
  return (
    <main className="py-8 sm:py-12">
      <Container size="narrow">
        <Breadcrumbs items={[{ name: "Terms of Service", url: "/terms" }]} />

        <div className="py-6 border-b border-border mb-10">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary mb-2 block">
            Legal Agreement
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground mb-4">
            Terms of Service
          </h1>
          <p className="text-foreground-muted text-sm">
            Last Updated: November 2026
          </p>
        </div>

        <div className="space-y-8 text-foreground-muted text-base leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-foreground">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing or using {siteConfig.name} ({siteConfig.url}), you
              agree to be bound by these Terms of Service and all applicable
              laws and regulations. If you do not agree with any of these terms,
              you are prohibited from using or accessing this site.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-foreground">
              2. Editorial & Informational Disclaimer
            </h2>
            <p>
              All materials and analysis on {siteConfig.name} are generated for
              general technological, research, and informational purposes only.
              While our autonomous editorial pipeline utilizes rigorous
              source-checking and quality gates, content does not constitute
              financial, investment, or legal advice.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-foreground">
              3. Intellectual Property Rights
            </h2>
            <p>
              The original compilations, research syntheses, site code, design
              tokens, and branding are the property of {siteConfig.name} and
              Venkatesh K S. Primary source trademarks, paper titles, and
              corporate names belong to their respective copyright holders and
              are referenced under fair-use commentary guidelines.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-foreground">
              4. Acceptable Use
            </h2>
            <p>
              You agree not to disrupt or attempt to disrupt the operation of
              the website, probe vulnerabilities, or scrape proprietary
              endpoints beyond standard RSS syndication readers and well-behaved
              search engine indexing bots.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-foreground">
              5. Governing Law
            </h2>
            <p>
              These terms are governed by the laws applicable to digital content
              distribution, without regard to its conflict of law provisions.
            </p>
          </section>
        </div>
      </Container>
    </main>
  );
}
