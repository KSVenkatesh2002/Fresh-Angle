import { TopicCandidate } from "@/services/research/topics";
import {
  extractArticleContent,
  discoverSecondarySources,
  ExtractedArticleSource,
} from "@/services/research/sources";

export interface ResearchResult {
  primarySource: ExtractedArticleSource;
  secondarySources: ExtractedArticleSource[];
  sources: ExtractedArticleSource[];
  formattedSourcesText: string;
}

export async function stepResearch(
  topic: TopicCandidate,
): Promise<ResearchResult> {
  console.log(
    `🔬 [Step 2/8: Research] Fetching and triangulating multi-source research for: "${topic.title}"...`,
  );

  // Extract the primary catalyst source
  const primarySource = await extractArticleContent(topic.url, topic.title);
  primarySource.role = "primary";

  // Triangulate with secondary technical sources (academic baseline or developer discussions)
  let secondarySources: ExtractedArticleSource[] = [];
  try {
    secondarySources = await discoverSecondarySources(topic.title, topic.url);
  } catch (err) {
    console.warn(`⚠️ [Research] Secondary source triangulation warning: ${(err as Error).message}`);
  }

  const sources: ExtractedArticleSource[] = [primarySource, ...secondarySources];

  // Format sources block for LLM prompts with distinct role labeling
  const formattedSourcesText = sources
    .map((s, idx) => {
      let roleLabel = "PRIMARY CATALYST / ANNOUNCEMENT";
      if (s.role === "academic_baseline") {
        roleLabel = "ACADEMIC BASELINE & THEORETICAL FOUNDATION";
      } else if (s.role === "community_discussion") {
        roleLabel = "COMMUNITY REACTION & REAL-WORLD DEPLOYMENT CONTEXT";
      } else if (idx > 0) {
        roleLabel = `SECONDARY SOURCE ${idx}`;
      }

      return `
[SOURCE ${idx + 1}: ${roleLabel}]
TITLE: ${s.title}
PUBLISHER: ${s.publisher}
URL: ${s.url}
CONTENT:
${s.content}
-------------------------
`;
    })
    .join("\n");

  console.log(
    `✓ [Research] Successfully assembled ${sources.length} source(s) (${1 + secondarySources.length} pillars, ${primarySource.content.length} primary chars) for triangulation.`,
  );

  return {
    primarySource,
    secondarySources,
    sources,
    formattedSourcesText,
  };
}
