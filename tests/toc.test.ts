import { describe, it, expect } from 'vitest';
import { extractTableOfContents } from '@/lib/markdown/toc';

describe('extractTableOfContents', () => {
  it('extracts H2 and H3 headings with correct levels and IDs', () => {
    const md = `
# Main Article Title (H1 - should be ignored by TOC)

Introduction paragraph.

## Architectural Innovations
Details about transformers.

### Attention Mechanism Enhancements
Further breakdown.

## Empirical Benchmark Results
Comparison with baseline models.

### Synthetic Data Pipeline
Explanation of data curation.
    `;

    const toc = extractTableOfContents(md);
    expect(toc).toHaveLength(4);

    expect(toc[0]).toEqual({
      id: 'architectural-innovations',
      text: 'Architectural Innovations',
      level: 2,
    });

    expect(toc[1]).toEqual({
      id: 'attention-mechanism-enhancements',
      text: 'Attention Mechanism Enhancements',
      level: 3,
    });

    expect(toc[2]).toEqual({
      id: 'empirical-benchmark-results',
      text: 'Empirical Benchmark Results',
      level: 2,
    });
  });

  it('ignores headings inside code blocks', () => {
    const md = `
## Legitimate Heading

\`\`\`markdown
## Code Example Heading
### Nested Code Heading
\`\`\`

## Another Legitimate Heading
    `;

    const toc = extractTableOfContents(md);
    expect(toc).toHaveLength(2);
    expect(toc[0].text).toBe('Legitimate Heading');
    expect(toc[1].text).toBe('Another Legitimate Heading');
  });

  it('handles empty markdown strings', () => {
    expect(extractTableOfContents('')).toEqual([]);
  });
});
