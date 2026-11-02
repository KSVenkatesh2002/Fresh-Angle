# Fresh Angle ✦

**Fresh Angle** is a production-quality, SEO-first, fully autonomous AI blog publication dedicated to artificial intelligence and technology intelligence. 

Every day at midnight UTC, an automated 8-step pipeline discovers trending breakthroughs from primary sources (RSS feeds, Hacker News), extracts real article text with Cheerio, synthesizes a fact-grounded post using multi-stage LLM chains (Outline → Draft → Fact-Check Review), generates a 1200x630 WebP cover image (Cloudflare Workers AI Flux-1 / Pexels), stores everything in Neon Postgres via Drizzle ORM, revalidates ISR cache, and dispatches a notification to Telegram.

---

## 🛠 Tech Stack

- **Framework**: Next.js 15 (App Router, Server Components by default, TypeScript strict mode)
- **Styling**: Tailwind CSS with a strict Semantic Color Token system backed by CSS variables (Zero raw colors rule)
- **Database**: Neon Serverless Postgres (`@neondatabase/serverless`) + Drizzle ORM
- **Validation**: Zod (environment variables, AI outputs, API endpoints)
- **Image Processing**: `sharp` (1200x630 WebP compression, target <125KB)
- **HTML/RSS Parsing**: `cheerio` (noise removal and text extraction) and `fast-xml-parser`
- **Markdown**: `react-markdown` + `rehype-slug` + `rehype-sanitize` + `remark-gfm`
- **Authentication**: Signed HTTP-only session cookies via `jose` (HS256)
- **Testing**: Vitest for pure business logic
- **Automation Scheduler**: GitHub Actions (`.github/workflows/daily-post.yml`)

---

## 📋 Environment Variables

Create `.env.local` based on `.env.example`:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon Postgres pooled connection string (`?sslmode=require`) |
| `SITE_URL` | Canonical site URL (default: `https://freshangle.vercel.app`) |
| `SITE_NAME` | Publication name (default: `Fresh Angle`) |
| `GEMINI_API_KEY` | Google Gemini API key |
| `GEMINI_MODEL` | Gemini model name (e.g., `gemini-2.5-flash`) |
| `GROQ_API_KEY` | Groq Cloud API key (fallback provider) |
| `GROQ_MODEL` | Groq model name (e.g., `llama-3.3-70b-versatile`) |
| `OPENROUTER_API_KEY` | (Optional) OpenRouter API key |
| `OPENROUTER_MODEL` | (Optional) OpenRouter model name |
| `CF_ACCOUNT_ID` | Cloudflare Account ID for Workers AI |
| `CF_API_TOKEN` | Cloudflare API Token with Workers AI permissions |
| `PEXELS_API_KEY` | Pexels API Key for stock photo fallback |
| `TELEGRAM_BOT_TOKEN`| Telegram Bot Token from @BotFather |
| `TELEGRAM_CHAT_ID` | Telegram Chat ID for publication alerts |
| `CRON_SECRET` | Secret token (min 16 chars) for `/api/revalidate` cache calls |
| `ADMIN_PASSWORD` | Password (min 8 chars) for `/admin` control panel |
| `SESSION_SECRET` | 32+ character key for signing admin session cookies |
| `AUTO_PUBLISH` | `true` to publish immediately, `false` to save as draft |

---

## ⚙️ How the Autonomous Pipeline Works

The daily pipeline (`scripts/generate-daily-post.ts` → `src/services/pipeline/run.ts`) executes 8 discrete, resilient steps:

1. **Pick Topic**: Ingests candidate items from high-signal RSS feeds (Ars Technica, The Verge AI, TechCrunch AI, VentureBeat AI, Hacker News). Filters by niche keywords and runs Jaccard + Levenshtein duplicate detection against existing posts and topic keys.
2. **Research**: Fetches 3–5 primary source articles, strips noise (ads, scripts, cookie banners) via Cheerio, and extracts clean, grounded text.
3. **Outline (AI Call 1)**: Generates a structured JSON outline with thesis, target track, and sub-headings.
4. **Draft (AI Call 2)**: Writes a comprehensive analytical post in Markdown. **Strict Grounding Rule**: The model is forbidden from inventing metrics, quotes, dates, or URLs.
5. **Review (AI Call 3)**: Fact-checks the draft against primary sources, eliminates filler, crafts SEO metadata (title under 90 chars, meta description under 155 chars), generates FAQ entries, tags, and cover image prompt.
6. **Cover Image**: Calls Cloudflare Workers AI (`flux-1-schnell`). If unavailable, searches Pexels with the topic keyword and attributes the photographer. If that fails, synthesizes a branded editorial SVG. Converts and compresses to 1200x630 WebP (<125KB) with `sharp`.
7. **Save & Publish**: Writes the post, image, tags, and source citations in a single database transaction.
8. **Notify & Revalidate**: Calls `POST /api/revalidate` with `CRON_SECRET` to invalidate Next.js ISR cache and dispatches an HTML briefing to Telegram.

---

## 🚀 Local Development

### 1. Install dependencies
```bash
npm install
```

### 2. Generate database schema & seed
```bash
npm run db:generate
npm run db:seed
```

### 3. Run development server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Run tests & code quality verification
```bash
npm run test          # Runs Vitest unit test suite
npm run lint          # Next.js ESLint + Semantic Colors check
npm run typecheck     # TypeScript strict compilation check
npm run check:colors  # Verifies ZERO raw Tailwind color classes in src/
```

### 5. Manually trigger the pipeline
```bash
npm run generate:post
```

---

## 🌐 Deploying to Vercel

1. Push this repository to GitHub.
2. Import the project into [Vercel](https://vercel.com).
3. Set the Environment Variables in **Project Settings → Environment Variables** (copy values from your `.env.local`).
4. Set the GitHub Actions Secrets in **GitHub Repository → Settings → Secrets and variables → Actions** with the same keys.
5. Enable the `.github/workflows/daily-post.yml` workflow for daily automated execution at 04:00 UTC.

---

## 🎨 Semantic Token Color System

To guarantee flawless light/dark mode transitions and brand consistency, direct palette colors (`bg-blue-500`, `text-gray-700`, `bg-[#fff]`) are **strictly prohibited** in component code. All UI elements utilize semantic theme tokens:

- `background`, `surface`, `surface-muted`
- `foreground`, `foreground-muted`
- `border`, `primary`, `primary-foreground`, `accent`
- `success`, `warning`, `danger`, `ring`

The automated `npm run check:colors` script enforces this rule in CI.
