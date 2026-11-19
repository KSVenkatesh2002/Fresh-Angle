import { fetchWithRetry } from "@/lib/utils/http";
import { PIPELINE_CONFIG } from "@/config/pipeline";

/**
 * Generates an editorial cover image using the free Pollinations Flux-Dev API.
 * Uses 1200x630 resolution, nologo=true, and 25-step Flux model.
 */
export async function generatePollinationsCover(prompt: string): Promise<Buffer> {
  const sanitizedPrompt = prompt
    .replace(/(with\s+)?(text|words?|letters?|title|headline|writing|logo|watermark)[^,]*/gi, "")
    .trim();

  const finalPrompt = `${sanitizedPrompt}, high resolution, masterpiece, no text, no words, no letters, no watermark, no logos`;

  const seed = Math.floor(Math.random() * 1000000);
  const encodedPrompt = encodeURIComponent(finalPrompt);
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1200&height=630&model=flux&nologo=true&seed=${seed}`;

  console.log(`🎨 [Pollinations AI] Requesting Flux cover: "${finalPrompt.slice(0, 90)}..."`);

  const response = await fetchWithRetry(
    url,
    {
      headers: {
        "User-Agent": "FreshAngleBot/1.0 (+https://freshangle.vercel.app)",
        Accept: "image/jpeg, image/png, image/webp, */*",
      },
      timeoutMs: PIPELINE_CONFIG.limits.httpTimeoutMs * 2, // 30s allowance for 25-step generation
    },
    { retries: 2, backoffMs: 1500 },
  );

  if (!response.ok) {
    throw new Error(`Pollinations API returned status ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length < 5000) {
    throw new Error(`Pollinations returned invalid small buffer: ${buffer.length} bytes`);
  }

  return buffer;
}

