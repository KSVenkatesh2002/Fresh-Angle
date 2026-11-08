if (typeof window !== "undefined") {
  throw new Error("Server-only module cannot be executed on the client");
}
import crypto from "crypto";
import { getEnv } from "@/lib/env";

export interface ImageUploadOptions {
  slug: string;
  altText?: string;
  width?: number;
  height?: number;
}

export interface UploadResult {
  publicUrl: string;
  storageKey: string;
  bytes: number;
  width: number;
  height: number;
  format: string;
}

export interface CloudinaryUsageStats {
  plan: string;
  lastUpdated: string;
  transformations: { usage: number; creditsUsage: number };
  objects: { usage: number };
  bandwidth: { usage: number; creditsUsage: number };
  storage: { usage: number; creditsUsage: number };
  credits: { usage: number; limit: number; usedPercent: number };
}

export interface ImageStorage {
  put(buffer: Buffer, options: ImageUploadOptions): Promise<UploadResult>;
  getUrl(storageKey: string, transformations?: string): string;
  delete(storageKey: string): Promise<boolean>;
  usage(): Promise<CloudinaryUsageStats>;
}

/**
 * Builds deterministic public_id: {folder}/{yyyy}/{mm}/{slug}-{shortHash}
 */
export function buildDeterministicPublicId(
  folder: string,
  slug: string,
  buffer: Buffer,
  date: Date = new Date(),
): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const shortHash = crypto
    .createHash("sha256")
    .update(buffer)
    .digest("hex")
    .slice(0, 8);
  const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  return `${folder}/${yyyy}/${mm}/${cleanSlug}-${shortHash}`;
}

export class CloudinaryImageStorage implements ImageStorage {
  private cloudName: string;
  private apiKey: string;
  private apiSecret: string;
  private folder: string;

  constructor() {
    const env = getEnv();
    this.cloudName = env.CLOUDINARY_CLOUD_NAME;
    this.apiKey = env.CLOUDINARY_API_KEY;
    this.apiSecret = env.CLOUDINARY_API_SECRET;
    this.folder = env.CLOUDINARY_FOLDER || "fresh-angle/covers";
  }

  /**
   * Generates SHA-1 signature for Cloudinary signed upload
   */
  private generateSignature(params: Record<string, string | number>): string {
    const sortedKeys = Object.keys(params).sort();
    const toSign = sortedKeys.map((k) => `${k}=${params[k]}`).join("&");
    return crypto
      .createHash("sha1")
      .update(toSign + this.apiSecret)
      .digest("hex");
  }

  /**
   * Uploads WebP image buffer to Cloudinary with deterministic key and retry backoff
   */
  async put(buffer: Buffer, options: ImageUploadOptions): Promise<UploadResult> {
    const publicId = buildDeterministicPublicId(this.folder, options.slug, buffer);
    const timestamp = Math.round(Date.now() / 1000);

    const paramsToSign: Record<string, string | number> = {
      overwrite: "false",
      public_id: publicId,
      timestamp,
    };

    if (options.altText) {
      paramsToSign.context = `alt=${options.altText.replace(/[|=]/g, " ")}`;
    }

    const signature = this.generateSignature(paramsToSign);

    const formData = new FormData();
    const blob = new Blob([new Uint8Array(buffer)], { type: "image/webp" });
    formData.append("file", blob, `${options.slug}.webp`);
    formData.append("api_key", this.apiKey);
    formData.append("timestamp", String(timestamp));
    formData.append("public_id", publicId);
    formData.append("overwrite", "false");
    formData.append("signature", signature);

    if (options.altText) {
      formData.append("context", paramsToSign.context as string);
    }

    const uploadUrl = `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`;
    let lastError: Error | null = null;

    // Retry with backoff: 3 attempts
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

        const res = await fetch(uploadUrl, {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          const errBody = await res.text();
          throw new Error(`Cloudinary upload failed (HTTP ${res.status}): ${errBody}`);
        }

        const data = await res.json();
        return {
          publicUrl: data.secure_url || data.url,
          storageKey: data.public_id,
          bytes: data.bytes || buffer.length,
          width: data.width || options.width || 1200,
          height: data.height || options.height || 630,
          format: data.format || "webp",
        };
      } catch (err: unknown) {
        lastError = err as Error;
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, attempt * 1000));
        }
      }
    }

    throw lastError || new Error("Failed to upload image to Cloudinary after 3 attempts");
  }

  /**
   * Constructs CDN delivery URL for a storage key
   */
  getUrl(storageKey: string, transformations: string = "f_auto,q_auto"): string {
    const cleanKey = storageKey.replace(/\.(webp|jpg|png)$/i, "");
    return `https://res.cloudinary.com/${this.cloudName}/image/upload/${transformations}/${cleanKey}.webp`;
  }

  /**
   * Deletes an asset by public_id
   */
  async delete(storageKey: string): Promise<boolean> {
    const timestamp = Math.round(Date.now() / 1000);
    const signature = this.generateSignature({
      public_id: storageKey,
      timestamp,
    });

    const formData = new FormData();
    formData.append("public_id", storageKey);
    formData.append("api_key", this.apiKey);
    formData.append("timestamp", String(timestamp));
    formData.append("signature", signature);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${this.cloudName}/image/destroy`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) return false;
    const data = await res.json();
    return data.result === "ok";
  }

  /**
   * Fetches real-time usage metrics from Cloudinary
   */
  async usage(): Promise<CloudinaryUsageStats> {
    const auth = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString("base64");
    const res = await fetch(`https://api.cloudinary.com/v1_1/${this.cloudName}/usage`, {
      headers: { Authorization: `Basic ${auth}` },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      throw new Error(`Cloudinary usage API error: HTTP ${res.status}`);
    }

    const d = await res.json();
    return {
      plan: d.plan || "Free",
      lastUpdated: d.last_updated || new Date().toISOString(),
      transformations: {
        usage: d.transformations?.usage || 0,
        creditsUsage: d.transformations?.credits_usage || 0,
      },
      objects: {
        usage: d.objects?.usage || 0,
      },
      bandwidth: {
        usage: d.bandwidth?.usage || 0,
        creditsUsage: d.bandwidth?.credits_usage || 0,
      },
      storage: {
        usage: d.storage?.usage || 0,
        creditsUsage: d.storage?.credits_usage || 0,
      },
      credits: {
        usage: d.credits?.usage || 0,
        limit: d.credits?.limit || 25,
        usedPercent: d.credits?.used_percent || 0,
      },
    };
  }
}

// Singleton storage client
let imageStorageInstance: ImageStorage | null = null;

export function getImageStorage(): ImageStorage {
  if (!imageStorageInstance) {
    imageStorageInstance = new CloudinaryImageStorage();
  }
  return imageStorageInstance;
}
