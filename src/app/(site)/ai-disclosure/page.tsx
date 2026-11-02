import React from "react";
import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { constructPageMetadata } from "@/lib/seo/metadata";
import { Bot, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = constructPageMetadata({
  title: "AI Disclosure & Editorial Ethics Policy",
  description:
    "Full transparency regarding how Fresh Angle uses artificial intelligence models to research, synthesize, and publish technical content.",
  path: "/ai-disclosure",
});

export default function AiDisclosurePage(): React.JSX.Element {
  return (
    <main className="py-8 sm:py-12">
      <Container size="narrow">
        <Breadcrumbs
          items={[{ name: "AI Disclosure", url: "/ai-disclosure" }]}
        />

        <div className="py-6 border-b border-border mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary mb-3">
            <Bot className="w-3.5 h-3.5" />
            <span>Transparency Standard</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground mb-3">
            AI Disclosure & Ethics Policy
          </h1>
          <p className="text-foreground-muted text-base max-w-xl leading-relaxed">
            {siteConfig.name} is committed to radical transparency in autonomous
            technical reporting. Here is how our system operates.
          </p>
        </div>

        <div className="space-y-8 text-foreground-muted text-base leading-relaxed">
          <section className="space-y-3 p-6 sm:p-8 rounded-2xl bg-surface border border-border shadow-sm">
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />
              <span>1. How AI is Used</span>
            </h2>
            <p className="leading-7">
              Articles published on Fresh Angle are generated via an autonomous
              research and synthesis engine. Large Language Models (including
              Google Gemini, Groq-hosted open weights, and OpenRouter models)
              are leveraged for:
            </p>
            <ul className="space-y-2 pl-4 text-foreground text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <span>
                  Extracting key architectural findings from engineering
                  announcements
                </span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <span>
                  Structuring technical outlines and identifying core tradeoffs
                </span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <span>Drafting clear, readable prose in original language</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <span>Generating relevant FAQ entries and metadata</span>
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-warning" />
              <span>2. Strict Fact Grounding Constraint</span>
            </h2>
            <p className="leading-7">
              Our models operate under strict system constraints:{" "}
              <strong>
                all metrics, benchmark numbers, quotes, and claims must directly
                originate from the provided primary sources.
              </strong>
            </p>
            <p className="leading-7">
              The pipeline forbids inventing statistics or hallucinating URLs.
              If a fact cannot be corroborated against the ingested source text,
              the review step is instructed to prune the statement.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <span>3. Primary Source Links on Every Post</span>
            </h2>
            <p className="leading-7">
              At the bottom of every dispatch, we list the exact primary URLs,
              publisher identities, and reference articles utilized during the
              research stage. We encourage readers to inspect the original
              sources for deeper verification.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              4. Cover Image Generation
            </h2>
            <p className="leading-7">
              Cover visuals are generated using Cloudflare Workers AI (Flux-1)
              or sourced from royalty-free photographers via Pexels with
              explicit attribution. Cover images are artistic conceptual
              representations and not literal photographs unless explicitly
              labeled.
            </p>
          </section>
        </div>
      </Container>
    </main>
  );
}
