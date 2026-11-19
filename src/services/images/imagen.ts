import { fetchWithRetry } from "@/lib/utils/http";
import { PIPELINE_CONFIG } from "@/config/pipeline";

interface ImagenPredictResponse {
  predictions?: Array<{
    bytesBase64Encoded?: string;
    mimeType?: string;
  }>;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

/**
 * Generates an editorial cover image using Google Imagen 3 via existing GEMINI_API_KEY.
 */
export async function generateImagenCover(prompt: string): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured for Imagen 3 fallback");
  }

  const sanitizedPrompt = prompt
    .replace(/(with\s+)?(text|words?|letters?|title|headline|writing|logo|watermark)[^,]*/gi, "")
    .trim();

  const finalPrompt = `${sanitizedPrompt}, cinematic lighting, high resolution, award-winning photography or digital illustration, strictly no text, no words, no letters, no watermark, no logos`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;

  console.log(`🎨 [Google Imagen 3] Generating cover image: "${finalPrompt.slice(0, 90)}..."`);

  const response = await fetchWithRetry(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instances: [
          {
            prompt: finalPrompt,
          },
        ],
        parameters: {
          sampleCount: 1,
          aspectRatio: "16:9",
          outputMimeType: "image/jpeg",
        },
      }),
      timeoutMs: PIPELINE_CONFIG.limits.aiTimeoutMs,
    },
    { retries: 1, backoffMs: 1500 },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Imagen 3 API failed (${response.status}): ${errorText.slice(0, 200)}`);
  }

  const data = (await response.json()) as ImagenPredictResponse;
  const base64Image = data.predictions?.[0]?.bytesBase64Encoded;

  if (!base64Image) {
    throw new Error("Google Imagen 3 returned empty prediction bytes");
  }

  return Buffer.from(base64Image, "base64");
}

