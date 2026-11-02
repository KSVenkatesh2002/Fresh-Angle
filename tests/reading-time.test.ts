import { describe, it, expect } from 'vitest';
import { calculateReadingTime } from '@/lib/utils/reading-time';

describe('calculateReadingTime', () => {
  it('returns 1 minute minimum for short texts or empty content', () => {
    expect(calculateReadingTime('')).toBe(1);
    expect(calculateReadingTime('Short update on a new model.')).toBe(1);
  });

  it('calculates approximately 200 words per minute', () => {
    const text250Words = Array(250).fill('word').join(' ');
    expect(calculateReadingTime(text250Words)).toBe(2);

    const text600Words = Array(600).fill('word').join(' ');
    expect(calculateReadingTime(text600Words)).toBe(3);
  });

  it('strips code blocks and markdown symbols before calculating word count', () => {
    const markdown = `
# Title

Here is a paragraph with several words explaining machine learning.

\`\`\`typescript
const a = 1;
const b = 2;
// Large repetitive code block that should not inflate reading time
function test() { return a + b; }
\`\`\`
    `;

    expect(calculateReadingTime(markdown)).toBe(1);
  });
});
