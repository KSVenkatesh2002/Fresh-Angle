import { TopicCandidate } from "@/services/research/topics";
import { PIPELINE_CONFIG } from "@/config/pipeline";
import {
  extractArticleContent,
  ExtractedArticleSource,
} from "@/services/research/sources";
import { gatherMultiSourceResearch } from "@/services/research/tavily";

export interface ResearchResult {
  primarySource: ExtractedArticleSource;
  secondarySources: ExtractedArticleSource[];
  sources: ExtractedArticleSource[];
  formattedSourcesText: string;
  researchDepth: "single" | "multi";
}

export async function stepResearch(
  topic: TopicCandidate,
): Promise<ResearchResult> {
  console.log(
    `🔬 [Step 2/8: Research] Fetching and triangulating multi-source research for: "${topic.title}"...`,
  );

  // 1. Extract the primary catalyst source
  const primarySource = await extractArticleContent(topic.url, topic.title);
  primarySource.role = "primary";
  if (primarySource.content.length > PIPELINE_CONFIG.limits.primarySourceCharLimit) {
    primarySource.content = `${primarySource.content.slice(
      0,
      PIPELINE_CONFIG.limits.primarySourceCharLimit,
    )}...`;
  }

  // 2. Triangulate with secondary technical sources (Tavily Search + arXiv + Hacker News)
  let secondarySources: ExtractedArticleSource[] = [];
  let researchDepth: "single" | "multi" = "single";

  try {
    const multiResearch = await gatherMultiSourceResearch(topic.title, topic.url);
    secondarySources = multiResearch.allSources;
    researchDepth = multiResearch.researchDepth;
  } catch (err) {
    console.warn(
      `⚠️ [Research] Multi-source research gathering encountered error: ${(err as Error).message}. Gracefully falling back to single-source.`,
    );
    researchDepth = "single";
  }

  const sources: ExtractedArticleSource[] = [primarySource, ...secondarySources];

  // 3. Format sources block for LLM prompts with distinct role labeling
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

  const cappedSourcesText =
    formattedSourcesText.length > PIPELINE_CONFIG.limits.maxTotalResearchPromptChars
      ? `${formattedSourcesText.slice(0, PIPELINE_CONFIG.limits.maxTotalResearchPromptChars)}\n...[TRUNCATED FOR PROMPT BUDGET]`
      : formattedSourcesText;

  console.log(
    `✓ [Research] Assembled ${sources.length} source(s) (Depth: ${researchDepth}, ${primarySource.content.length} primary chars, ${cappedSourcesText.length} total prompt chars) for triangulation.`,
  );

  return {
    primarySource,
    secondarySources,
    sources,
    formattedSourcesText: cappedSourcesText,
    researchDepth,
  };
}
