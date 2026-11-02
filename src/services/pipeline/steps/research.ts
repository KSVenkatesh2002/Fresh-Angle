import { TopicCandidate } from "@/services/research/topics";
import {
  extractArticleContent,
  ExtractedArticleSource,
} from "@/services/research/sources";

export interface ResearchResult {
  primarySource: ExtractedArticleSource;
  sources: ExtractedArticleSource[];
  formattedSourcesText: string;
}

export async function stepResearch(
  topic: TopicCandidate,
): Promise<ResearchResult> {
  console.log(
    `🔬 [Step 2/8: Research] Fetching and analyzing article sources for: "${topic.title}"...`,
  );

  // Extract the primary source first
  const primarySource = await extractArticleContent(topic.url, topic.title);
  const sources: ExtractedArticleSource[] = [primarySource];

  // Format sources block for LLM prompts
  const formattedSourcesText = sources
    .map(
      (s, idx) => `
[SOURCE ${idx + 1}]
TITLE: ${s.title}
PUBLISHER: ${s.publisher}
URL: ${s.url}
CONTENT:
${s.content}
-------------------------
`,
    )
    .join("\n");

  console.log(
    `✓ [Research] Successfully extracted ${sources.length} source(s) with ${primarySource.content.length} characters of clean text.`,
  );

  return {
    primarySource,
    sources,
    formattedSourcesText,
  };
}
