# Fresh Angle ✦ Production Autonomous AI Publication

**Fresh Angle** is a production-quality, SEO-first, fully automated multi-category AI blog publication engineered with Next.js 15 App Router, TypeScript strict mode, and Neon Serverless Postgres.

---

## 🏛 Architecture Overview

```
                                      [ GitHub Actions ]
                                  (Runs tick.ts every 30m)
                                              │
                                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SCHEDULING ENGINE (tick.ts)                       │
│  1. Advisory Lock  2. Due Scheduled  3. Ensure Slots  4. Run Pipeline Slot  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             8-STAGE PIPELINE                                │
│                                                                             │
│  [1. Discover]   RSS Feeds (Ars, Verge, TechCrunch, VentureBeat) + HN      │
│         │        Multi-layer Dedupe (URL, Jaccard, Trigram, Levenshtein)   │
│         ▼                                                                   │
│  [2. Research]   Cheerio noise stripping, primary fact extraction           │
│         │                                                                   │
│  [3. Outline]    AI Call 1: Structured JSON thesis & H2 section breakdown   │
│         │                                                                   │
│  [4. Draft]      AI Call 2: Fact-grounded markdown (No fabricated stats)    │
│         │                                                                   │
│  [5. Review]     AI Call 3: Fact verification, SEO meta, FAQ, and tags      │
│         │                                                                   │
│  [6. Linking]    Link candidate retrieval + DB validation + Graph writing   │
│         │                                                                   │
│  [7. Cover Art]  Cloudflare Workers AI (Flux-1) ➔ Pexels ➔ Sharp WebP (<125KB)
│         │                                                                   │
│  [8. Publish]    Neon Postgres TX ➔ ISR Revalidation ➔ IndexNow ➔ Telegram  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 👤 Creator Profile & Attribution

The site architecture and engineering is created and maintained by **Venkatesh K S**:

- **Creator Name**: Venkatesh K S
- **Portfolio Website**: [https://venkatesh-k-s.vercel.app](https://venkatesh-k-s.vercel.app)
- **Local Photo**: `public/images/creator.png` (verified local asset, never hotlinked)
- **Schema Attribution**: Sourced in `src/config/site.ts` and referenced in JSON-LD `Person` schemas with `sameAs` links.
- **Editorial Disclaimer**: All research dispatches are bylined to the autonomous editorial AI engine as AI-assisted; the creator is transparently presented as the system architect.

---

## 📋 Environment Variables

Validated at runtime fail-fast by Zod in `src/lib/env.ts` with `server-only`:

### Required Variables

| Variable                | Description                         | Example / Notes                                                      |
| ----------------------- | ----------------------------------- | -------------------------------------------------------------------- |
| `DATABASE_URL`          | Neon Serverless Postgres pooled URL | `postgresql://user:pass@ep-xyz.aws.neon.tech/neondb?sslmode=require` |
| `SITE_URL`              | Canonical domain                    | `https://freshangle.vercel.app`                                      |
| `SITE_NAME`             | Publication Name                    | `Fresh Angle`                                                        |
| `DEFAULT_TIMEZONE`      | Timezone identifier                 | `Asia/Kolkata`                                                       |
| `GEMINI_API_KEY`        | Google AI Studio Key                | Gemini 2.5 Flash / Flash Lite                                        |
| `GEMINI_MODEL`          | Primary Gemini model name           | `gemini-2.5-flash`                                                   |
| `GROQ_API_KEY`          | Groq Cloud API Key                  | Fallback high-speed inference                                        |
| `GROQ_MODEL`            | Groq model name                     | `openai/gpt-oss-120b` or `llama-3.3-70b-versatile`                   |
| `CF_ACCOUNT_ID`         | Cloudflare Account ID               | For Workers AI Flux image generation                                 |
| `CF_API_TOKEN`          | Cloudflare Workers AI Token         | Read/Execute Workers AI                                              |
| `CF_IMAGE_MODEL`        | Image model name                    | `@cf/black-forest-labs/flux-1-schnell`                               |
| `PEXELS_API_KEY`        | Pexels Stock Photo Key              | Image fallback with photographer attribution                         |
| `CRON_SECRET`           | Secret key (min 16 chars)           | For on-demand revalidation authorization                             |
| `ADMIN_PASSWORD`        | Mission Control password            | Authentication for `/admin` panel                                    |
| `SESSION_SECRET`        | 32+ character key                   | Signed HTTP-only session cookie via `jose`                           |
| `GITHUB_REPO`           | Owner/Repo for dispatches           | `KSVenkatesh2002/Fresh-Angle`                                        |
| `GITHUB_DISPATCH_TOKEN` | Personal Access Token               | For admin manual generation triggers                                 |
| `CREATOR_NAME`          | Portfolio creator name              | `Venkatesh K S`                                                      |
| `CREATOR_URL`           | Creator portfolio URL               | `https://venkatesh-k-s.vercel.app`                                   |
| `CREATOR_IMAGE`         | Creator profile image path          | `/images/creator.png`                                                |

### Optional Variables

| Variable                   | Description                                       |
| -------------------------- | ------------------------------------------------- |
| `OPENROUTER_API_KEY`       | Tertiary AI fallback provider                     |
| `TELEGRAM_BOT_TOKEN`       | Bot token for publication & failure notifications |
| `TELEGRAM_CHAT_ID`         | Telegram chat/channel ID                          |
| `TELEGRAM_THREAD_ID`       | Optional thread/topic ID in forum groups          |
| `INDEXNOW_KEY`             | Instant Bing/Yandex/Seznam indexing key           |
| `GOOGLE_SITE_VERIFICATION` | Google Search Console verification code           |
| `BING_SITE_VERIFICATION`   | Bing Webmaster verification code                  |

---

## 🚀 Local Development Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env.local` and populate the required API keys.

### 3. Generate Schema & Run Seed

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the public site, or [http://localhost:3000/admin](http://localhost:3000/admin) for the control panel.

---

## 🧪 Verification & Quality Commands

All 12 scripts must pass with zero errors and zero warnings:

```bash
npm run typecheck     # Strict TypeScript type check
npm run test          # Vitest suite (40+ pure logic tests)
npm run lint          # Next.js ESLint + zero raw color check
npm run check:colors  # Verifies strict semantic theme token compliance
npm run tick          # Executes 30-min scheduler tick logic
npm run generate:post # Generates a fresh dispatch end-to-end
```

---

## 🎨 Semantic Token Theme System

To guarantee responsive dark mode transitions without visual flash or inconsistent hex codes, components strictly use semantic theme tokens:

- **Surfaces**: `bg-background`, `bg-surface`, `bg-surface-muted`
- **Typography**: `text-foreground`, `text-foreground-muted`
- **Borders & Rings**: `border-border`, `ring-ring`
- **Actions & Feedback**: `bg-primary`, `text-primary-foreground`, `text-success`, `text-warning`, `text-danger`

Direct Tailwind palette classes (`bg-blue-500`, `text-gray-900`) and arbitrary hex codes are strictly prohibited and automatically rejected by `scripts/check-colors.mjs`.

---

## 🔍 Indexing & SEO Architecture

1. **Static Generation with ISR**: `generateStaticParams` with `dynamicParams = true` ensures instantaneous responses while allowing immediate publication without rebuilding.
2. **On-Demand Revalidation**: When a post publishes, `/api/revalidate` updates the post page, home feed, category hubs, tag archives, date archives, and sitemap.
3. **IndexNow Instant Ping**: Automatically notifies Bing and partner engines immediately upon publishing; key served dynamically via `/:key.txt`.
4. **Structured JSON-LD**: Comprehensive `WebSite`, `Organization`, `BlogPosting`, `BreadcrumbList`, `FAQPage`, `Person` (About), and `CollectionPage` schemas validated against schema.org.
5. **Production Isolation**: When `VERCEL_ENV !== 'production'`, all pages return `noindex, nofollow` and `robots.txt` disallows all crawlers.

---

## 🌐 Deploying to Vercel

1. Push code to your GitHub repository.
2. Import project into **Vercel**.
3. Configure all environment variables in **Project Settings → Environment Variables**.
4. Configure GitHub Actions Secrets in **GitHub Settings → Secrets → Actions**.
5. Enable GitHub Actions for `.github/workflows/tick.yml` to automate publication every 30 minutes.

---

## 🐦 Auto-Publish Control, Draft Privacy & Buffer X Auto-Posting

### 1. Auto-Publish ON/OFF Switch & Draft Hold Reasons
- **Admin Switch**: Toggle **Auto-publish new posts** (`ON` / `OFF`) on `/admin/automation` (saved to `automation_settings.publish_mode` in Postgres and logged to `audit_log`; `/admin/schedule` shows a read-only status indicator).
- **Runtime Precedence**: The DB switch overrides the `AUTO_PUBLISH` env var; `AUTO_PUBLISH` is used only as a fallback when no DB row exists. Quality/originality gates still hold failing posts as drafts even when `ON`. Manually scheduled posts (`status: scheduled`) still publish on schedule even when `OFF`.
- **Draft Privacy**: Unpublished posts (`draft`, `scheduled`, `archived`) return `404` to logged-out visitors and render uncached (`noStore()`) with a `"Draft preview, not public"` banner and `noindex, nofollow` for authenticated admins.

### 2. Buffer X Auto-Posting Setup
1. Log into X and connect your X account as a channel inside [Buffer](https://publish.buffer.com).
2. Create a Personal Access key at `https://publish.buffer.com/settings/api` (`Personal Access` → `+ New Key`).
3. Set these variables in **all three places** (local `.env`, **Vercel Environment Variables**, and **GitHub Actions Secrets** for `.github/workflows/tick.yml` & `generate-now.yml`):
   - `ENABLE_X_POSTING` — set `"true"` to enable (`"false"` by default).
   - `BUFFER_API_KEY` — personal API key from Buffer.
   - `BUFFER_X_CHANNEL_ID` — *(optional)* Buffer X channel ID; auto-discovered & cached if omitted (pinning saves 1 GraphQL call per cold start).
   - `BUFFER_X_MODE` — `"shareNow"` *(default, bypasses Buffer's 10-slot queue cap)* or `"addToQueue"`.

### 3. Manual Test Checklist, Retry & Disable
- **Test Connection**: Open `/admin/posts` and click **Send test post to X** (sends a harmless verification post via Buffer even before enabling auto-posting).
- **Retry Failed/Skipped**: In `/admin/posts`, inspect the **X Status** badge (`posted`, `failed`, `skipped`, `pending`) and click **Retry X post** on any published post that has not succeeded. Already-`posted` articles are never re-posted on unpublish/republish.
- **Emergency Disable**: Set `ENABLE_X_POSTING=false` in Vercel & GitHub Actions Secrets (blog publishing and IndexNow continue unaffected).

### 4. Extra X Promotional Schedule & Tick Precision
- Configure **Extra X posts per day**, **Monthly X cap** (default `300`, counting both blog-link posts and extras), posting window (`08:00–22:00`), and `xNoRepeatDays` (default `14`) on `/admin/automation`.
- **Tick Precision & Timezone**: Extra X slots run from the existing scheduler tick (~15-minute cadence in active hours), using `DEFAULT_TIMEZONE` (`Asia/Kolkata`) for X windows and daily/monthly counters (while the blog post scheduler continues using UTC).
