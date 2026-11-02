import { fetchWithRetry } from "@/lib/utils/http";
import { z } from "zod";

const pexelsSearchResponseSchema = z.object({
  photos: z.array(
    z.object({
      id: z.number(),
      photographer: z.string(),
      photographer_url: z.string(),
      src: z.object({
        large2x: z.string().optional(),
        large: z.string().optional(),
        original: z.string().optional(),
      }),
    }),
  ),
});

export interface PexelsImageResult {
  buffer: Buffer;
  credit: string;
  photographerUrl: string;
}

export async function searchPexelsImage(
  keyword: string,
): Promise<PexelsImageResult> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey || apiKey.startsWith("your_")) {
    throw new Error("PEXELS_API_KEY is not configured in environment");
  }

  const query = encodeURIComponent(keyword.trim());
  const url = `https://api.pexels.com/v1/search?query=${query}&per_page=1&orientation=landscape`;

  console.log(`📷 [Pexels] Searching stock photo for: "${keyword}"`);

  const response = await fetchWithRetry(
    url,
    {
      headers: {
        Authorization: apiKey,
      },
      timeoutMs: 15000,
    },
    {
      retries: 2,
      backoffMs: 1000,
    },
  );

  if (!response.ok) {
    throw new Error(
      `Pexels API error (${response.status}): ${response.statusText}`,
    );
  }

  const json = await response.json();
  const parsed = pexelsSearchResponseSchema.safeParse(json);

  if (!parsed.success || parsed.data.photos.length === 0) {
    throw new Error(`No stock photos found on Pexels for keyword "${keyword}"`);
  }

  const photo = parsed.data.photos[0];
  const imageUrl = photo.src.large2x || photo.src.large || photo.src.original;

  if (!imageUrl) {
    throw new Error("Pexels photo did not contain a valid image URL");
  }

  // Download photo binary
  const imgResponse = await fetchWithRetry(
    imageUrl,
    { timeoutMs: 20000 },
    { retries: 2, backoffMs: 1000 },
  );

  if (!imgResponse.ok) {
    throw new Error(
      `Failed to download photo from Pexels: ${imgResponse.statusText}`,
    );
  }

  const arrayBuffer = await imgResponse.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    credit: `Photo by ${photo.photographer} on Pexels`,
    photographerUrl: photo.photographer_url,
  };
}
