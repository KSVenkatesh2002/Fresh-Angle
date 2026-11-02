import { describe, it, expect } from "vitest";
import { normalizeUrl } from "../src/lib/utils/url";

describe("URL Normalization", () => {
  it("strips www. from hostname", () => {
    expect(normalizeUrl("https://www.theverge.com/ai/article")).toBe(
      "https://theverge.com/ai/article",
    );
  });

  it("strips all utm_* parameters", () => {
    expect(
      normalizeUrl(
        "https://techcrunch.com/post?utm_source=twitter&utm_medium=social&utm_campaign=launch",
      ),
    ).toBe("https://techcrunch.com/post");
  });

  it("strips tracking parameters like fbclid and gclid", () => {
    expect(
      normalizeUrl(
        "https://arstechnica.com/ai-update?fbclid=12345&gclid=67890&ref=hn",
      ),
    ).toBe("https://arstechnica.com/ai-update");
  });

  it("removes URL fragments and anchors", () => {
    expect(normalizeUrl("https://example.com/deep-learning#section-2")).toBe(
      "https://example.com/deep-learning",
    );
  });

  it("preserves valid functional search parameters", () => {
    expect(normalizeUrl("https://arxiv.org/abs/2402.1234?v=2")).toBe(
      "https://arxiv.org/abs/2402.1234?v=2",
    );
  });

  it("strips trailing slashes from pathnames", () => {
    expect(normalizeUrl("https://example.com/models/gpt-4/")).toBe(
      "https://example.com/models/gpt-4",
    );
  });
});
