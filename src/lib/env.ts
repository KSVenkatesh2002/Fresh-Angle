if (typeof window !== "undefined") {
  throw new Error("Server-only module cannot be executed on the client");
}
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SITE_URL: z.string().url().default("https://freshangle.vercel.app"),
  SITE_NAME: z.string().default("Fresh Angle"),
  DEFAULT_TIMEZONE: z.string().default("Asia/Kolkata"),

  // AI Providers
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
  GEMINI_MODEL: z.string().default("gemini-3.5-flash-lite"),
  GROQ_API_KEY: z.string().min(1, "GROQ_API_KEY is required"),
  GROQ_MODEL: z.string().default("openai/gpt-oss-120b"),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().optional(),

  // Image Generation & Cloudinary Storage
  CF_ACCOUNT_ID: z.string().min(1, "CF_ACCOUNT_ID is required"),
  CF_API_TOKEN: z.string().min(1, "CF_API_TOKEN is required"),
  CF_IMAGE_MODEL: z.string().default("@cf/black-forest-labs/flux-1-schnell"),
  PEXELS_API_KEY: z.string().default("your_pexels_api_key"),
  CLOUDINARY_CLOUD_NAME: z.string().min(1, "CLOUDINARY_CLOUD_NAME is required"),
  CLOUDINARY_API_KEY: z.string().min(1, "CLOUDINARY_API_KEY is required"),
  CLOUDINARY_API_SECRET: z.string().min(1, "CLOUDINARY_API_SECRET is required"),
  CLOUDINARY_FOLDER: z.string().default("fresh-angle/covers"),
  IMAGE_FALLBACK: z.enum(["default_image", "draft"]).default("default_image"),

  // Security & Admin
  CRON_SECRET: z.string().min(1, "CRON_SECRET is required"),
  ADMIN_PASSWORD: z.string().optional(),
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters")
    .optional(),

  // GitHub Dispatch
  GITHUB_REPO: z.string().optional(),
  GH_REPO: z.string().default("KSVenkatesh2002/Fresh-Angle"),
  GITHUB_DISPATCH_TOKEN: z.string().optional(),
  GH_DISPATCH_TOKEN: z.string().optional(),

  // Creator
  CREATOR_NAME: z.string().optional(),
  CREATOR_URL: z.string().optional(),
  CREATOR_IMAGE: z.string().optional(),

  // Optional External Integrations
  EMBEDDING_PROVIDER: z.enum(["none", "gemini"]).default("none"),
  EMBEDDING_MODEL: z.string().optional(),
  NEWS_API_PROVIDER: z.enum(["gnews", "newsdata"]).optional(),
  NEWS_API_KEY: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  TELEGRAM_THREAD_ID: z.string().optional(),
  GOOGLE_SITE_VERIFICATION: z.string().optional(),
  BING_SITE_VERIFICATION: z.string().optional(),
  INDEXNOW_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  AUTO_PUBLISH: z.string().default("true"),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("❌ Invalid environment variables:", result.error.format());
    throw new Error("Environment variable validation failed");
  }
  return result.data;
}

let envCache: Env | null = null;

export function getEnv(): Env {
  if (envCache) return envCache;

  if (process.env.NODE_ENV === "test") {
    const parseResult = envSchema.safeParse(process.env);
    if (!parseResult.success) {
      return {
        DATABASE_URL: process.env.DATABASE_URL || "postgres://dummy:dummy@localhost:5432/dummy",
        SITE_URL: process.env.SITE_URL || "https://freshangle.vercel.app",
        SITE_NAME: process.env.SITE_NAME || "Fresh Angle",
        DEFAULT_TIMEZONE: process.env.DEFAULT_TIMEZONE || "Asia/Kolkata",
        GEMINI_API_KEY: process.env.GEMINI_API_KEY || "dummy-gemini-key",
        GROQ_API_KEY: process.env.GROQ_API_KEY || "dummy-groq-key",
        CF_ACCOUNT_ID: process.env.CF_ACCOUNT_ID || "dummy-cf-account",
        CF_API_TOKEN: process.env.CF_API_TOKEN || "dummy-cf-token",
        CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || "test-cloud",
        CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || "test-key",
        CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || "test-secret",
        CLOUDINARY_FOLDER: process.env.CLOUDINARY_FOLDER || "fresh-angle/covers",
        IMAGE_FALLBACK: (process.env.IMAGE_FALLBACK as "default_image" | "draft") || "default_image",
        CRON_SECRET: process.env.CRON_SECRET || "dummy-cron-secret",
        ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "dummy-admin-password",
        SESSION_SECRET: process.env.SESSION_SECRET || "dummy-session-secret-min-32-chars-long",
        AUTO_PUBLISH: process.env.AUTO_PUBLISH || "true",
        EMBEDDING_PROVIDER: "none",
      } as Env;
    }
    return parseResult.data;
  }

  envCache = validateEnv();
  return envCache;
}

export const env = new Proxy({} as Env, {
  get(_target, prop: string | symbol) {
    return getEnv()[prop as keyof Env];
  },
});
