import { generateCloudflareCover } from "./cloudflare";
import { generatePollinationsCover } from "./pollinations";
import { generateImagenCover } from "./imagen";
import { searchPexelsImage } from "./pexels";
import { processImageToWebp, generateDefaultBrandedCover } from "./process";
import { recordUsage } from "@/services/usage/tracker";

export interface CoverGenerationInput {
  prompt: string;
  keyword: string;
  title: string;
  category: string;
  altText: string;
}

export interface GeneratedCoverResult {
  buffer: Buffer;
  source: "ai" | "pexels" | "default";
  credit?: string;
  alt: string;
}

/**
 * Executes the resilient 5-tier cover image pipeline:
 * 1. Cloudflare Workers AI (@cf/black-forest-labs/flux-1-schnell)
 * 2. Pollinations Flux-Dev (25-step free AI synthesis)
 * 3. Google Imagen 3 (via GEMINI_API_KEY)
 * 4. Pexels stock photo search
 * 5. Default branded editorial SVG/WebP vector
 * Always processes with sharp to 1200x630 WebP under ~125KB.
 */
export async function getCoverImage(
  input: CoverGenerationInput,
): Promise<GeneratedCoverResult> {
  // Step 1: Try Cloudflare Workers AI
  try {
    const rawBuffer = await generateCloudflareCover(input.prompt, {
      title: input.title,
      category: input.category,
      enhanceWithAi: true,
    });
    const webpBuffer = await processImageToWebp(rawBuffer);
    console.log(
      `✓ [Cover] Generated AI cover via Cloudflare flux-1-schnell (${Math.round(webpBuffer.length / 1024)} KB)`,
    );
    void recordUsage({ provider: "cloudflare", kind: "image", images: 1 });
    return {
      buffer: webpBuffer,
      source: "ai",
      credit: undefined,
      alt: input.altText,
    };
  } catch (cfErr: unknown) {
    console.warn(
      `⚠️ [Cover] Cloudflare AI failed: ${(cfErr as Error).message}. Trying Pollinations Flux fallback...`,
    );
    void recordUsage({ provider: "cloudflare", kind: "image", isError: true });
  }

  // Step 2: Fallback to Pollinations Flux-Dev
  try {
    const rawBuffer = await generatePollinationsCover(input.prompt);
    const webpBuffer = await processImageToWebp(rawBuffer);
    console.log(
      `✓ [Cover] Generated AI cover via Pollinations Flux-Dev (${Math.round(webpBuffer.length / 1024)} KB)`,
    );
    return {
      buffer: webpBuffer,
      source: "ai",
      credit: undefined,
      alt: input.altText,
    };
  } catch (polErr: unknown) {
    console.warn(
      `⚠️ [Cover] Pollinations Flux failed: ${(polErr as Error).message}. Trying Google Imagen 3 fallback...`,
    );
  }

  // Step 3: Fallback to Google Imagen 3 (via GEMINI_API_KEY)
  if (process.env.GEMINI_API_KEY) {
    try {
      const rawBuffer = await generateImagenCover(input.prompt);
      const webpBuffer = await processImageToWebp(rawBuffer);
      console.log(
        `✓ [Cover] Generated AI cover via Google Imagen 3 (${Math.round(webpBuffer.length / 1024)} KB)`,
      );
      void recordUsage({ provider: "gemini", kind: "image", images: 1 });
      return {
        buffer: webpBuffer,
        source: "ai",
        credit: undefined,
        alt: input.altText,
      };
    } catch (imagenErr: unknown) {
      console.warn(
        `⚠️ [Cover] Google Imagen 3 failed: ${(imagenErr as Error).message}. Trying Pexels fallback...`,
      );
      void recordUsage({ provider: "gemini", kind: "image", isError: true });
    }
  }

  // Step 4: Fallback to Pexels stock search
  try {
    const pexelsResult = await searchPexelsImage(input.keyword);
    const webpBuffer = await processImageToWebp(pexelsResult.buffer);
    console.log(
      `✓ [Cover] Fetched Pexels stock photo (${Math.round(webpBuffer.length / 1024)} KB)`,
    );
    void recordUsage({ provider: "pexels", kind: "image", images: 1 });
    return {
      buffer: webpBuffer,
      source: "pexels",
      credit: pexelsResult.credit,
      alt: `${input.title} - ${pexelsResult.credit}`,
    };
  } catch (pexelsErr: unknown) {
    console.warn(
      `⚠️ [Cover] Pexels fallback failed: ${(pexelsErr as Error).message}. Using default branded cover...`,
    );
    void recordUsage({ provider: "pexels", kind: "image", isError: true });
  }

  // Step 5: Default Branded Editorial Image
  const defaultBuffer = await generateDefaultBrandedCover(
    input.title,
    input.category,
  );
  const webpBuffer = await processImageToWebp(defaultBuffer);
  console.log(
    `✓ [Cover] Created branded fallback cover (${Math.round(webpBuffer.length / 1024)} KB)`,
  );

  return {
    buffer: webpBuffer,
    source: "default",
    credit: "Fresh Angle Editorial",
    alt: `${input.title} - Fresh Angle Editorial Cover`,
  };
}
