import { LIMITS } from "@/config/limits";

export interface QualityGateResult {
  passed: boolean;
  score: number; // 0 to 100
  issues: string[];
  wordCount: number;
}

const BANNED_FILLERS = [
  "in today's fast-paced world",
  "delve into",
  "testament to",
  "it remains to be seen",
  "only time will tell",
  "tapestry of",
  "in conclusion",
  "a game-changer",
  "in this digital era",
];

const PLACEHOLDERS = [
  "lorem ipsum",
  "[insert",
  "todo:",
  "[placeholder]",
  "xyz corp",
  "as an ai",
];

export function evaluateQualityGates(params: {
  title: string;
  excerpt: string;
  contentMd: string;
  metaTitle?: string;
  metaDescription?: string;
  sourcesCount?: number;
}): QualityGateResult {
  const issues: string[] = [];
  let deductions = 0;

  // 1. Word Count
  const words = params.contentMd.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  if (wordCount < LIMITS.minWordCount) {
    issues.push(
      `Word count too low: ${wordCount} words (minimum ${LIMITS.minWordCount} required)`,
    );
    deductions += 30;
  }

  // 2. Headings count (H2)
  const h2Matches = params.contentMd.match(/^##\s+.+$/gm) || [];
  if (h2Matches.length < LIMITS.minH2Headings) {
    issues.push(
      `Insufficient H2 sections: ${h2Matches.length} found (minimum ${LIMITS.minH2Headings} required)`,
    );
    deductions += 20;
  }

  // 3. Key Takeaways
  const hasKeyTakeaways = /key takeaways/i.test(params.contentMd);
  if (!hasKeyTakeaways) {
    issues.push("Missing Key Takeaways summary section");
    deductions += 15;
  }

  // 4. Banned filler phrases
  const lowerContent = params.contentMd.toLowerCase();
  for (const filler of BANNED_FILLERS) {
    if (lowerContent.includes(filler)) {
      issues.push(`Banned filler phrase detected: "${filler}"`);
      deductions += 10;
    }
  }

  // 5. Placeholder text
  for (const placeholder of PLACEHOLDERS) {
    if (lowerContent.includes(placeholder)) {
      issues.push(`Placeholder text detected: "${placeholder}"`);
      deductions += 25;
    }
  }

  // 6. Title and Meta lengths
  if (
    params.title.length < LIMITS.titleMinChars ||
    params.title.length > LIMITS.titleMaxChars
  ) {
    issues.push(
      `Title length ${params.title.length} chars out of bounds (${LIMITS.titleMinChars}-${LIMITS.titleMaxChars})`,
    );
    deductions += 10;
  }

  const metaDesc = params.metaDescription || params.excerpt;
  if (metaDesc.length > LIMITS.metaDescMaxChars) {
    issues.push(
      `Meta description exceeds ${LIMITS.metaDescMaxChars} characters (${metaDesc.length} chars)`,
    );
    deductions += 10;
  }

  // 7. Sources count
  if (params.sourcesCount !== undefined && params.sourcesCount === 0) {
    issues.push("No primary research sources attached to dispatch");
    deductions += 15;
  }

  const score = Math.max(0, 100 - deductions);
  const passed = issues.length === 0 || score >= 80;

  return {
    passed,
    score,
    issues,
    wordCount,
  };
}
