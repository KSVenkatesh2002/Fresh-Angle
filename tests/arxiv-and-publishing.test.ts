import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extractArxivId,
  extractArxivPaperContent,
  stripBoilerplate,
} from "@/services/research/sources";
import { constructPostMetadata } from "@/lib/seo/metadata";

describe("arXiv Extraction & Draft SEO Safeguards", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("extracts arXiv paper IDs from abs, html, and pdf URLs", () => {
    expect(extractArxivId("https://arxiv.org/abs/2611.32918")).toBe("2611.32918");
    expect(extractArxivId("https://arxiv.org/html/2501.01234v2")).toBe("2501.01234v2");
    expect(extractArxivId("https://huggingface.co/blog/optimum-inference")).toBeNull();
  });

  it("extracts real paper abstract instead of arXivLabs footer boilerplate", async () => {
    // Mock html/ fetch returning 404 so /abs/ blockquote extraction runs cleanly
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      return new Response("Not found", { status: 404 });
    });

    const mockAbsHtml = `
      <html>
        <head><meta name="citation_title" content="InstructReplay: Preserving Behavior" /></head>
        <body>
          <main id="content">
            <h1 class="title"><span class="descriptor">Title:</span>InstructReplay: Preserving Behavior</h1>
            <div class="authors"><span class="descriptor">Authors:</span>Alice Smith, Bob Jones</div>
            <blockquote class="abstract mathjax">
              <span class="descriptor">Abstract:</span>Fine-tuning an instruction-tuned language model on new facts often erodes general capabilities by 35 points. We propose historical replay buffers to retain alignment.
            </blockquote>
            <div id="labs">
              <p>arXivLabs is a framework that allows collaborators to develop and share new arXiv features directly on our website.</p>
              <p>Both individuals and organizations that work with arXivLabs have embraced and accepted our values.</p>
            </div>
          </main>
        </body>
      </html>
    `;

    const result = await extractArxivPaperContent(
      "https://arxiv.org/abs/2611.32918",
      mockAbsHtml,
      "Fallback Title",
    );

    expect(result.title).toBe("InstructReplay: Preserving Behavior");
    expect(result.content).toContain("Fine-tuning an instruction-tuned language model");
    expect(result.content).toContain("Alice Smith, Bob Jones");
    expect(result.content).not.toContain("arXivLabs is a framework");
  });

  it("strips arXivLabs footer text in stripBoilerplate", () => {
    const dirty = `arXivLabs is a framework that allows collaborators to develop and share new arXiv features.\nReal technical insight about quantization.`;
    const clean = stripBoilerplate(dirty);
    expect(clean).toBe("Real technical insight about quantization.");
  });

  it("sets robots noindex on draft post metadata when noIndex is true", () => {
    const meta = constructPostMetadata({
      title: "Draft Post",
      description: "Preview description",
      slug: "draft-post",
      publishedAt: new Date("2026-11-26T00:00:00Z"),
      noIndex: true,
    });
    expect(meta.robots).toEqual({ index: false, follow: false });

    const pubMeta = constructPostMetadata({
      title: "Published Post",
      description: "Live description",
      slug: "published-post",
      publishedAt: new Date("2026-11-26T00:00:00Z"),
    });
    expect(pubMeta.robots).toMatchObject({ index: true, follow: true });
  });
});

