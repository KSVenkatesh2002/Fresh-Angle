import { defaultAiChain } from "@/services/ai/fallback";
import { outlineSchema, OutlineOutput } from "@/services/pipeline/schemas";
import {
  SYSTEM_EDITORIAL_PERSONA,
  buildOutlinePrompt,
} from "@/services/pipeline/prompts/templates";

export interface OutlineResult {
  outline: OutlineOutput;
  provider: string;
  model: string;
}

export async function stepOutline(
  topicTitle: string,
  formattedSourcesText: string,
): Promise<OutlineResult> {
  console.log(
    "📝 [Step 3/8: Outline] Generating structured outline (AI call 1)...",
  );

  const prompt = buildOutlinePrompt(topicTitle, formattedSourcesText);
  const { data: outline, result } = await defaultAiChain.generateValidatedJson(
    {
      system: SYSTEM_EDITORIAL_PERSONA,
      prompt,
      temperature: 0.3,
    },
    outlineSchema,
  );

  console.log(
    `✓ [Outline] Created outline with ${outline.sections.length} sections: "${outline.proposedTitle}"`,
  );

  return {
    outline,
    provider: result.provider,
    model: result.model,
  };
}
