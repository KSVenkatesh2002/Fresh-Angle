import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { constructPageMetadata } from "@/lib/seo/metadata";
import { siteConfig } from "@/config/site";
import {
  ShieldCheck,
  BookOpen,
  AlertOctagon,
  CheckCircle2,
} from "lucide-react";

export const metadata: Metadata = constructPageMetadata({
  title: "Editorial Standards & Fact-Grounding Policy",
  description: `Our rigorous commitment to verifiable truth, primary source citation, and zero hallucination on ${siteConfig.name}.`,
  path: "/editorial-policy",
});

export default function EditorialPolicyPage(): React.JSX.Element {
  return (
    <main className="py-8 sm:py-12">
      <Container size="narrow">
        <Breadcrumbs
          items={[{ name: "Editorial Policy", url: "/editorial-policy" }]}
        />

        <div className="py-6 border-b border-border mb-10">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary mb-2 block">
            Editorial Integrity
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground mb-4">
            Editorial Policy & Fact-Grounding
          </h1>
          <p className="text-foreground-muted text-lg leading-relaxed">
            How Fresh Angle ensures every publication is strictly anchored in
            verifiable primary evidence.
          </p>
        </div>

        <div className="space-y-10 text-foreground text-base leading-relaxed">
          <section className="space-y-4">
            <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <span>1. Zero-Tolerance for Fabrication</span>
            </h2>
            <p className="text-foreground-muted leading-7">
              Autonomous AI journalism is only as valuable as its reliability.
              The Fresh Angle generation pipeline enforces strict prompt
              conditioning and programmatic quality gates designed to prevent
              hallucination:
            </p>
            <ul className="space-y-2.5 text-sm text-foreground-muted">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                <span>
                  <strong>Grounded Metrics:</strong> Benchmarks (MMLU,
                  HumanEval, latency, FLOPS) must exist verbatim in the primary
                  research source.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                <span>
                  <strong>No Fake Quotes:</strong> Direct quotes are only
                  permitted if explicitly uttered in public corporate press
                  releases or paper abstracts.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                <span>
                  <strong>No Filler Phrases:</strong> Fluff like &quot;in this
                  fast-paced world&quot; or &quot;only time will tell&quot; is
                  filtered programmatically.
                </span>
              </li>
            </ul>
          </section>

          <section className="space-y-4 p-6 sm:p-8 rounded-2xl bg-surface border border-border">
            <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              <span>2. Multi-Stage Peer Review Pipeline</span>
            </h2>
            <p className="text-foreground-muted text-sm leading-relaxed">
              Every piece of content undergoes three independent LLM stages
              before reaching the quality verification gate:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-sm text-foreground-muted">
              <li>
                <strong>Outline Synthesis:</strong> Analyzes raw dispatches,
                extracts primary claims, and builds structured H2/H3 headers.
              </li>
              <li>
                <strong>Draft Generation:</strong> Expands technical sections
                with deep architectural context and key takeaways.
              </li>
              <li>
                <strong>Editorial Critique:</strong> An adversarial AI reviewer
                tests the draft against the primary evidence to catch
                discrepancies.
              </li>
            </ol>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <AlertOctagon className="w-5 h-5 text-warning" />
              <span>3. Corrections & Community Feedback</span>
            </h2>
            <p className="text-foreground-muted leading-7">
              We provide interactive feedback tools directly at the bottom of
              every article. Readers can report discrepancies or factual errors
              with one click. Confirmed issues are investigated and corrected
              promptly. Read our full{" "}
              <Link
                href="/ai-disclosure"
                className="text-primary hover:underline"
              >
                AI Ethics & Disclosure Statement
              </Link>{" "}
              or reach out via our{" "}
              <Link href="/contact" className="text-primary hover:underline">
                Contact Form
              </Link>
              .
            </p>
          </section>
        </div>
      </Container>
    </main>
  );
}
