import { z } from "zod";
import {
  AiProvider,
  AiGenerationResult,
  GenerateTextOptions,
} from "./provider";
import { GeminiProvider } from "./gemini";
import { GroqProvider } from "./groq";
import { OpenRouterProvider } from "./openrouter";
import { recordUsage } from "@/services/usage/tracker";

export class AiFallbackChain {
  private providers: AiProvider[];

  constructor(customProviders?: AiProvider[]) {
    this.providers = customProviders ?? [
      new GroqProvider(),
      new GeminiProvider(),
      new OpenRouterProvider(),
    ];
  }

  /**
   * Executes prompt against the provider chain with fallback on failure.
   */
  async generateText(
    options: GenerateTextOptions,
  ): Promise<AiGenerationResult> {
    const errors: Array<{ provider: string; error: string }> = [];

    for (const provider of this.providers) {
      try {
        console.log(`🤖 [AI Chain] Calling provider: ${provider.name}...`);
        const result = await provider.generateText(options);
        console.log(
          `✓ [AI Chain] Succeeded with ${provider.name} (${result.model})`,
        );

        // Record successful provider usage
        void recordUsage({
          provider: provider.name,
          kind: "text",
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
        });

        return result;
      } catch (err: unknown) {
        const errorMsg = (err as Error).message;
        console.warn(
          `⚠️ [AI Chain] Provider ${provider.name} failed: ${errorMsg}`,
        );
        errors.push({ provider: provider.name, error: errorMsg });

        // Record error for provider
        void recordUsage({
          provider: provider.name,
          kind: "text",
          isError: true,
        });
      }
    }

    const failureSummary = errors
      .map((e) => `  - ${e.provider}: ${e.error}`)
      .join("\n");
    throw new Error(
      `❌ All AI providers in fallback chain failed:\n${failureSummary}`,
    );
  }

  /**
   * Generates text, parses JSON, and validates with Zod.
   * If parsing fails, retries once with a targeted repair prompt.
   */
  async generateValidatedJson<T>(
    options: GenerateTextOptions,
    schema: z.ZodType<T>,
  ): Promise<{ data: T; result: AiGenerationResult }> {
    const jsonOptions: GenerateTextOptions = {
      ...options,
      json: true,
    };

    let result = await this.generateText(jsonOptions);
    let parsedData = this.tryParseAndValidate(result.text, schema);

    if (parsedData.success) {
      return { data: parsedData.data, result };
    }

    // Retry once with a targeted JSON-repair prompt
    console.warn(
      `⚠️ [AI Chain] JSON validation failed (${parsedData.error}). Prompting AI to repair JSON...`,
    );

    const repairPrompt = `
The previous output did not match the required JSON schema or contained a syntax error:
Validation Error: ${parsedData.error}

Original output received:
${result.text}

Please output ONLY a valid, corrected JSON object complying strictly with the requirements. No markdown code blocks, no explanations.
`;

    result = await this.generateText({
      system: options.system,
      prompt: repairPrompt,
      json: true,
      temperature: 0.2,
    });

    parsedData = this.tryParseAndValidate(result.text, schema);

    if (!parsedData.success) {
      throw new Error(
        `❌ [AI Chain] Failed to produce valid JSON after repair retry: ${parsedData.error}\nRaw output: ${result.text}`,
      );
    }

    return { data: parsedData.data, result };
  }

  private tryParseAndValidate<T>(
    text: string,
    schema: z.ZodType<T>,
  ): { success: true; data: T } | { success: false; error: string } {
    try {
      // Clean possible markdown code fences (```json ... ```)
      const cleanJson = text
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/, "")
        .replace(/\s*```$/, "")
        .trim();

      const parsed = JSON.parse(cleanJson);
      const validated = schema.safeParse(parsed);

      if (!validated.success) {
        return {
          success: false,
          error: validated.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join(", "),
        };
      }

      return { success: true, data: validated.data };
    } catch (err) {
      return {
        success: false,
        error: (err as Error).message,
      };
    }
  }
}

export const defaultAiChain = new AiFallbackChain();
