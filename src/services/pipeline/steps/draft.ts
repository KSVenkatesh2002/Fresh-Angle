import { defaultAiChain } from '@/services/ai/fallback';
import { OutlineOutput } from '@/services/pipeline/schemas';
import { SYSTEM_EDITORIAL_PERSONA, buildDraftPrompt } from '@/services/pipeline/prompts/templates';

export interface DraftResult {
  draftMarkdown: string;
  provider: string;
  model: string;
}

export async function stepDraft(
  topicTitle: string,
  outline: OutlineOutput,
  formattedSourcesText: string
): Promise<DraftResult> {
  console.log('✍️ [Step 4/8: Draft] Drafting comprehensive Markdown post (AI call 2)...');

  const outlineJson = JSON.stringify(outline, null, 2);
  const prompt = buildDraftPrompt(topicTitle, outlineJson, formattedSourcesText);

  const result = await defaultAiChain.generateText({
    system: SYSTEM_EDITORIAL_PERSONA,
    prompt,
    temperature: 0.6,
  });

  console.log(`✓ [Draft] Generated draft (${result.text.length} characters) via ${result.provider}`);

  return {
    draftMarkdown: result.text,
    provider: result.provider,
    model: result.model,
  };
}
