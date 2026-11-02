import { fetchWithRetry } from '@/lib/utils/http';
import { z } from 'zod';

const cfImageResponseSchema = z.object({
  result: z.object({
    image: z.string().optional(),
  }).optional(),
  success: z.boolean().optional(),
  errors: z.array(z.unknown()).optional(),
});

export async function generateCloudflareCover(prompt: string): Promise<Buffer> {
  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CF_API_TOKEN;

  if (!accountId || !apiToken) {
    throw new Error('CF_ACCOUNT_ID or CF_API_TOKEN is not configured');
  }

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`;

  console.log(`🎨 [Cloudflare AI] Generating cover image with prompt: "${prompt.slice(0, 80)}..."`);

  const response = await fetchWithRetry(
    endpoint,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: `${prompt}, clean composition, professional tech editorial publication quality, highly detailed, 8k, aspect ratio 16:9`,
        steps: 4,
      }),
      timeoutMs: 45000,
    },
    {
      retries: 2,
      backoffMs: 2000,
    }
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Cloudflare AI failed (${response.status}): ${errorText}`);
  }

  const contentType = response.headers.get('content-type') || '';

  // Cloudflare AI can return either binary image/png or JSON containing base64
  if (contentType.includes('image/')) {
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  const json = await response.json();
  const parsed = cfImageResponseSchema.safeParse(json);

  if (parsed.success && parsed.data.result?.image) {
    return Buffer.from(parsed.data.result.image, 'base64');
  }

  throw new Error('Cloudflare AI response did not contain image data');
}
