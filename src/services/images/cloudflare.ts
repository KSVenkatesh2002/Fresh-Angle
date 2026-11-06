import { fetchWithRetry } from "@/lib/utils/http";
import { z } from "zod";
import { AiFallbackChain } from "@/services/ai/fallback";

const cfImageResponseSchema = z.object({
  result: z
    .object({
      image: z.string().optional(),
    })
    .optional(),
  success: z.boolean().optional(),
  errors: z.array(z.unknown()).optional(),
});

export interface GenerateCoverOptions {
  title?: string;
  category?: string;
  enhanceWithAi?: boolean;
}

/**
 * Uses Google Gemini (via AiFallbackChain) to expand a raw concept/title into a
 * visually rich, topic-tailored, and hallucination-free Flux-1 image prompt.
 */
async function generateAiPrompt(rawPrompt: string, title?: string, category?: string): Promise<string> {
  const chain = new AiFallbackChain();

  const system = `You are an award-winning creative art director and prompt engineer specializing in editorial 3D and macro art for Flux-1 Schnell.
Given an article title and a concept, your job is to craft a single, unique, visually captivating image prompt for the cover image.

RULES:
1. Capture the unique core theme of the specific article (e.g. personal finance, home security, cloud GPU clusters, synthetic biology, agentic coding).
2. DO NOT use generic semiconductor chips, circuit boards, or processors unless the article is explicitly about microchips or semiconductor manufacturing.
3. Describe tangible physical materials, lighting, depth, and atmosphere (e.g. brushed titanium, frosted optical glass, architectural studio rim lighting, volumetric depth, Octane 3D render, 8k).
4. Strictly NEVER include words, text, typography, letters, logos, brand names, UI screens, watermarks, or human faces.
5. Output ONLY the prompt text in 1-2 detailed sentences without conversational preamble or quotes.`;

  const user = `Article Title: ${title || "Cutting-Edge Tech Perspective"}
Category: ${category || "Artificial Intelligence"}
Base Concept: ${rawPrompt}

Optimized Flux-1 Image Prompt:`;

  try {
    const result = await chain.generateText({
      system,
      prompt: user,
      temperature: 0.7,
    });
    const cleaned = result.text.replace(/^["']|["']$/g, "").trim();
    if (cleaned.length > 20) {
      return cleaned;
    }
  } catch (err: unknown) {
    console.warn(`⚠️ [Cover Prompt AI] Failed to generate AI prompt: ${(err as Error).message}. Falling back to sanitized prompt.`);
  }

  return rawPrompt;
}

export async function generateCloudflareCover(
  prompt: string,
  options: GenerateCoverOptions = {},
): Promise<Buffer> {
  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CF_API_TOKEN;

  if (!accountId || !apiToken) {
    throw new Error("CF_ACCOUNT_ID or CF_API_TOKEN is not configured");
  }

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`;

  let effectivePrompt = prompt;

  // Generate an enhanced, topic-specific prompt using AI if enabled (default true)
  if (options.enhanceWithAi !== false) {
    console.log("🎨 [Cloudflare AI] Generating custom topic-specific image prompt with AI...");
    effectivePrompt = await generateAiPrompt(prompt, options.title, options.category);
  }

  const sanitizedPrompt = effectivePrompt
    .replace(
      /(with\s+)?(text|words?|letters?|title|headline|writing|logo|watermark)[^,]*/gi,
      "",
    )
    .trim();

  const refinedPrompt = `${sanitizedPrompt}, modern 3D editorial art, tactile premium materials, cinematic studio lighting, volumetric depth, octane render, 8k resolution, minimalist architectural composition, strictly no text, no words, no letters, no logos, no watermarks, no distorted faces`;

  console.log(
    `🎨 [Cloudflare AI] Generating cover image with prompt: "${refinedPrompt.slice(0, 100)}..."`,
  );

  const response = await fetchWithRetry(
    endpoint,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: refinedPrompt,
        steps: 8,
      }),
      timeoutMs: 45000,
    },
    {
      retries: 2,
      backoffMs: 2000,
    },
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Cloudflare AI failed (${response.status}): ${errorText}`);
  }

  const contentType = response.headers.get("content-type") || "";

  // Cloudflare AI can return either binary image/png or JSON containing base64
  if (contentType.includes("image/")) {
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  const json = await response.json();
  const parsed = cfImageResponseSchema.safeParse(json);

  if (parsed.success && parsed.data.result?.image) {
    return Buffer.from(parsed.data.result.image, "base64");
  }

  throw new Error("Cloudflare AI response did not contain image data");
}
