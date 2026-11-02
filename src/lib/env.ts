import "server-only";
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

  // Image Generation
  CF_ACCOUNT_ID: z.string().min(1, "CF_ACCOUNT_ID is required"),
  CF_API_TOKEN: z.string().min(1, "CF_API_TOKEN is required"),
  CF_IMAGE_MODEL: z.string().default("@cf/black-forest-labs/flux-1-schnell"),
  PEXELS_API_KEY: z.string().default("your_pexels_api_key"),
  IMAGE_STORAGE: z.enum(["db", "r2"]).default("db"),

  // Security & Admin
  CRON_SECRET: z.string().min(1, "CRON_SECRET is required"),
  ADMIN_PASSWORD: z.string().min(1, "ADMIN_PASSWORD is required"),
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters"),

  // GitHub Dispatch
  GITHUB_REPO: z.string().default("KSVenkatesh2002/Fresh-Angle"),
  GITHUB_DISPATCH_TOKEN: z.string().optional(),

  // Creator
  CREATOR_NAME: z.string().default("Venkatesh K S"),
  CREATOR_URL: z.string().default("https://venkatesh-k-s.vercel.app"),
  CREATOR_IMAGE: z.string().default("/images/creator.png"),

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

export const env = validateEnv();
