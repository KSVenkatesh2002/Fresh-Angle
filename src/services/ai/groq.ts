import { AiProvider, AiGenerationResult, AiProviderError, GenerateTextOptions } from './provider';
import { fetchWithRetry } from '@/lib/utils/http';
import { PIPELINE_CONFIG } from '@/config/pipeline';
import { z } from 'zod';

const groqChatResponseSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        content: z.string().nullable(),
      }),
    })
  ),
});

export class GroqProvider implements AiProvider {
  public readonly id = 'groq';
  public readonly name = 'Groq';

  async generateText(options: GenerateTextOptions): Promise<AiGenerationResult> {
    const apiKey = process.env.GROQ_API_KEY;
    const model = process.env.GROQ_MODEL;

    if (!apiKey) {
      throw new AiProviderError(this.id, 'GROQ_API_KEY is not configured in environment');
    }
    if (!model) {
      throw new AiProviderError(this.id, 'GROQ_MODEL is not configured in environment');
    }

    const messages = [];
    if (options.system) {
      messages.push({ role: 'system', content: options.system });
    }
    messages.push({ role: 'user', content: options.prompt });

    const endpoint = 'https://api.groq.com/openai/v1/chat/completions';

    try {
      const response = await fetchWithRetry(
        endpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: options.temperature ?? 0.7,
            response_format: options.json ? { type: 'json_object' } : undefined,
          }),
          timeoutMs: PIPELINE_CONFIG.limits.aiTimeoutMs,
        },
        {
          retries: PIPELINE_CONFIG.limits.maxRetries,
          backoffMs: 2000,
        }
      );

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new AiProviderError(
          this.id,
          `Groq API responded with status ${response.status}: ${errText}`,
          response.status
        );
      }

      const json = await response.json();
      const parsed = groqChatResponseSchema.safeParse(json);

      if (!parsed.success || !parsed.data.choices[0]?.message.content) {
        throw new AiProviderError(this.id, 'Invalid response structure from Groq API');
      }

      return {
        text: parsed.data.choices[0].message.content,
        model,
        provider: this.name,
      };
    } catch (err: unknown) {
      if (err instanceof AiProviderError) throw err;
      throw new AiProviderError(
        this.id,
        `Unexpected failure during Groq text generation: ${(err as Error).message}`,
        undefined,
        err
      );
    }
  }
}
