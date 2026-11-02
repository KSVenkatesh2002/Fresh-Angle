import 'server-only';
import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Site Info
  SITE_URL: z.string().url('SITE_URL must be a valid URL').default('https://freshangle.vercel.app'),
  SITE_NAME: z.string().min(1).default('Fresh Angle'),

  // AI Providers
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
  GEMINI_MODEL: z.string().min(1, 'GEMINI_MODEL is required'),
  GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY is required'),
  GROQ_MODEL: z.string().min(1, 'GROQ_MODEL is required'),
  OPENROUTER_API_KEY: z.string().optional().or(z.literal('')),
  OPENROUTER_MODEL: z.string().optional().or(z.literal('')),

  // Cover Image Generation & Stock
  CF_ACCOUNT_ID: z.string().min(1, 'CF_ACCOUNT_ID is required'),
  CF_API_TOKEN: z.string().min(1, 'CF_API_TOKEN is required'),
  PEXELS_API_KEY: z.string().min(1, 'PEXELS_API_KEY is required'),

  // Notifications
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),
  TELEGRAM_CHAT_ID: z.string().min(1, 'TELEGRAM_CHAT_ID is required'),

  // Security
  CRON_SECRET: z.string().min(16, 'CRON_SECRET must be at least 16 characters'),
  ADMIN_PASSWORD: z.string().min(8, 'ADMIN_PASSWORD must be at least 8 characters'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),

  // Pipeline Settings
  AUTO_PUBLISH: z
    .enum(['true', 'false'])
    .default('true')
    .transform((val) => val === 'true'),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `❌ [Environment Validation Error] Invalid or missing environment variables:\n${errorDetails}\nPlease check your .env or .env.local file against .env.example.`
    );
  }

  cachedEnv = result.data;
  return cachedEnv;
}

// Safe check helper for build time or optional checks
export function getOptionalEnv(): Partial<Env> {
  const result = envSchema.partial().safeParse(process.env);
  return result.success ? result.data : {};
}
